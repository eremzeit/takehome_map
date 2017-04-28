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
  return Files.readAllSamplesAllFiles().then((sampleGroups) => {
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
      let latRes = Constants.RAW_SAMPLES_LAT_RESOLUTION * scale
      let lngRes = Constants.RAW_SAMPLES_LNG_RESOLUTION * scale

      let aggregatedSamples = aggregateSamples(samples, latRes, lngRes)

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
        console.log('samples inserted: ', res.insertedCount)
      })
    })

    return Promise.all(tasks)
  })
}

function aggregateSamples(samples, newLatCellSize, newLngCellSize) {
  let grid = {}

  // Create a dict of dicts with the structure:
  //    latIndex -> lngIndex -> [samples_in_region]
  for (let i = 0; i < samples.length; i++) {
    let sample = samples[i];

    let latIdx = Math.floor(sample.loc.coordinates[0] / newLatCellSize);
    let lngIdx = Math.floor(sample.loc.coordinates[1] / newLngCellSize);

    if (!grid[latIdx]) {
      grid[latIdx] = {}
    }

    if (!grid[latIdx][lngIdx]) {
      let sampleRegion = {
        center: [
          latIdx * newLatCellSize + newLatCellSize / 2,
          lngIdx * newLngCellSize + newLngCellSize / 2
        ],
        samples: []
      };


      grid[latIdx][lngIdx] = sampleRegion;
    }

    grid[latIdx][lngIdx].samples.push(sample);
  }

  // an array of arrays of samples
  let groupedCells = _.chain(grid).values().map(function(dict) {
    return _.values(dict);
  }).flatten().value();

  // flatten the groups into individual cells
  let newSamples = _.chain(groupedCells).map(function(sampleRegion) {
    return combineSamples(sampleRegion.samples, sampleRegion.center, newLatCellSize, newLngCellSize);
  }).value();

  return newSamples;
}

function combineSamples(samples, center, latSize, lngSize) {
  // Here I use the max of the intensity when aggregating neighbors, but
  // there are pros and cons to this.  Better product experience would be
  // to allow the user to choose how they want their data to be aggregated.
  let intensity = _.max(samples, function(s) {return s.intensity}).intensity

  let point = [parseFloat(center[0]), parseFloat(center[1])]

  if (!point[0] || !point[1]) {
    console.log('pointaoesnuth', point)
  }
  return {
    loc: { type: "Point", coordinates: point },
    intensity: intensity,
    latSize: latSize,
    lngSize: lngSize
  }
}

function queryPoints(north, south, east, west, dataLayerId) {
  // what's a good cell size, given the size of our query window?
  const BALLPARK_MAX_OBJECTS = 1000

  let scale = Constants.SUPPORTED_SCALES.find((scale) => {
    let latSize = scale * Constants.RAW_SAMPLES_LAT_RESOLUTION
    let lngSize = scale * Constants.RAW_SAMPLES_LNG_RESOLUTION

    let ballparkObjects = (north - south) / latSize * (west - east) / lngSize;
    console.log('scale: ', scale, ballparkObjects)
    return ballparkObjects < BALLPARK_MAX_OBJECTS
  })

  if (!scale) {
    scale = _.last(Constants.SUPPORTED_SCALES)
  }

  let q = {
    loc: {
      $geoWithin: {
        $geometry: {
          type: "Polygon",

          //note: there's an extra level of array to allow for holes in the polygon
          coordinates: [[
            [north, west],
            [north, east],
            [south, east],
            [south, west],
            [north, west],
          ]]
        },
      }
    },

    scale: {$eq: scale},
    dataLayerId: {$eq: dataLayerId},
  }

  return dbService.ready.then((db) => {
    return db.collection('agg_samples').find(q).toArray().then((r) => {
      console.log('fetched ', r.length)
      return r
    })
  })
}

module.exports = {
  initData,
  queryPoints,
}
