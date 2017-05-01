const jsonfile = require('jsonfile')
const fs = require('fs')
const _ = require('underscore')
const dbService = require('./db')
const Q = require('q')
const Files = require('./files')
const Constants = require('./constants')

function test() {
  initData().catch((err) => {
    console.error('error:', err)
  });
}

function initData() {
  return dbService.resetDb().then(() => {
    return Files.readAllSamplesAllFiles()
  }).then((sampleGroups) => {

    ////TEMP
    //let x = sampleGroups.shift()
    //sampleGroups.push(x)


    return _.map(sampleGroups, (sampleGroup, i) => {
      return replaceDataLayer(sampleGroup, i)
    })
  })
}

function replaceDataLayer(samples, dataLayerId) {
  return dbService.ready.then((db) => {
    // for each possible resolution, downsample and save to the appropriate collection
    let tasks = Constants.SUPPORTED_SCALES.map((scale) => {
      // our resolution could technically be anything, but if we keep our data resolution
      // to be a multiple of the original raw data we should be able to keep some accuracy
      // and prevent artifacts

      let aggregatedSamples = aggregateSamples(samples, scale)

      //let coll = 'dataset' + dataLayerId + '_downsample' + scale;
      let coll = db.collection('agg_samples') // just put them all in the same collection

      let recordsToAdd = aggregatedSamples.filter((sample) => {
        return _.isNumber(sample.intensity) && sample.intensity > 0
      }).map((sample) => {
        return Object.assign(sample, {
          dataLayerId: dataLayerId,
          scale: scale
        })
      })

      //TODO: this could be moved outside the loop and done only once over a larger batch
      return coll.insertMany(recordsToAdd).then((res) => {
        //console.log('samples inserted: ', res.insertedCount)
      })
    })

    return Promise.all(tasks)
  })
}

function cellSizesFromScale(scale) {
  return {
    latSize: Constants.RAW_SAMPLES_LAT_RESOLUTION * scale,
    lngSize: Constants.RAW_SAMPLES_LNG_RESOLUTION * scale
  }
}

function projectionCoords(coords, scale) {
  let { latSize, lngSize } = cellSizesFromScale(scale)
  let lat = coords[0]
  let lng = coords[1]
  const fudgeFactor = 0.000005

  return {
    latIdx: Math.floor((lat - fudgeFactor) / latSize),
    lngIdx: Math.floor((lng - fudgeFactor) / lngSize),
    latSize: Constants.RAW_SAMPLES_LAT_RESOLUTION * scale,
    lngSize: Constants.RAW_SAMPLES_LNG_RESOLUTION * scale
  }
}

function aggregateSamples(samples, scale) {
  let grid = {}
  let { latSize, lngSize } = cellSizesFromScale(scale)

  // assign the projected index to the objects
  _.each(samples, (s) => {
    Object.assign(s, projectionCoords(s.loc.coordinates, scale))
  })

  let groups = _.chain(samples).groupBy((sample) => {
    return [sample.latIdx, sample.lngIdx]
  }).values().map((samples) => {
    return {
      center: [samples[0].latIdx * latSize + latSize / 2, samples[0].lngIdx * lngSize + lngSize / 2],
      samples: samples
    }
  }).value()

  let invalidGroups = _.filter(groups, x => x.length > 1)
  console.log('invalid: ', JSON.stringify(invalidGroups.slice(0,3), null, 2))

  // flatten the groups into individual cells
  let newSamples = _.chain(groups).map(function(sampleRegion) {
    return combineSamples(sampleRegion.samples, sampleRegion.center, latSize, lngSize);
  }).value();

  //console.log('newSamples:', JSON.stringify(newSamples.slice(0, 3)));

  //TODO: this logic is wrong
  return newSamples;
}

function combineSamples(samples, center, latSize, lngSize) {
  //console.log('latSize, lngSize:', latSize, lngSize)

  // Here I use the max of the intensity when aggregating neighbors, but
  // there are pros and cons to this.  Better product experience would be
  // to allow the user to choose how they want their data to be aggregated.
  let intensity = _.max(samples, function(s) {return s.intensity}).intensity

  let point = [parseFloat(center[0]), parseFloat(center[1])]

  return {
    loc: { type: "Point", coordinates: point },
    intensity: intensity,
    color: intensityToColor(intensity),
    latSize: latSize,
    lngSize: lngSize,
  }
}

function queryPointsAndMakeShapes(queryArea, dataLayerId, scale) {
  return queryPoints(queryArea, dataLayerId, scale).then((points) => {
    return _.map(points, (point) => {
      return convertPointToCell(point, point.latSize, point.lngSize)
    })
  });
}

function convertPointToCell(point, latCellSize, lngCellSize) {
  let center = point.loc.coordinates

  let coordinates = [
    [center[0] + latCellSize / 2, center[1] - lngCellSize / 2],
    [center[0] + latCellSize / 2, center[1] + lngCellSize / 2],
    [center[0] - latCellSize / 2, center[1] + lngCellSize / 2],
    [center[0] - latCellSize / 2, center[1] - lngCellSize / 2],
  ]

  return Object.assign({}, point, {
    loc: {
      type: 'Polygon',
      coordinates
    },
    center
  })
}

function queryPoints(boundingPath, dataLayerId, scale) {
  // what's a good cell size, given the size of our query window?
  if (!_.contains(Constants.SUPPORTED_SCALES, scale)) {
    scale = Constants.SUPPORTED_SCALES.find((_scale) => {
      return _scale >= scale
    })
  }

  if (!scale) {
    scale = _.last(Constants.SUPPORTED_SCALES)
  }
  console.log('Response scale: ', scale )

  let q = {
    loc: {
      $geoWithin: {
        $geometry: {
          type: "Polygon",

          //note: there's an extra level of array to allow for holes in the polygon
          coordinates: [boundingPath]
        },
      }
    },

    scale: {$eq: scale},
    dataLayerId: {$eq: dataLayerId},
  }


  //console.log('query: ', JSON.stringify(q, null, 2))

  return dbService.ready.then((db) => {
    return db.collection('agg_samples').find(q).toArray().then((r) => {

      let errors = _.filter((r) => {
        !_.isNumber(r.scale) || !_.isNumber(r.latSize) || r.latSize / 0.005 != r.scale || r.lngSize / 0.005 != r.scale
      })

      if (errors.length) {
        console.log('ERRORS: ', errors)
      }

      console.log('fetched ', r.length)
      return r
    })
  }).catch((err) => {
    console.log('error while querying db: ', err)
    throw err
  })
}

// TODO: doing a linear scan every time we want to find a color intensity is
// less efficient than a binary search
function intensityToColor(intensity) {
  let colorLookup = Constants.COLOR_LOOKUP

  if (intensity == 0) {
    return null;
  }

  let color;
  for (let i = 0; i < colorLookup.length; i++) {
    if (intensity >= colorLookup[i][0]) {
      color = colorLookup[i][1];
      continue;
    } else if (intensity < colorLookup[i][0]) {
      break;
    }
  }

  if (color) {
    return toHexString(color[0], color[1], color[2]);
  } else {
    return null;
  }
}

function toHex (c) {
  var hex = parseInt(c).toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function toHexString(r, g, b) {
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

module.exports = {
  initData,
  queryPoints,
  queryPointsAndMakeShapes
}


