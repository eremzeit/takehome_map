const Q = require('q')

const Constants = require('./constants')
const _ = require('underscore')

const fudgeFactor = 0.000005

function cellSizesFromScale(scale) {
  return {
    latSize: Constants.LAT_DEGREES_PER_SCALE * scale,
    lngSize: Constants.LNG_DEGREES_PER_SCALE * scale
  }
}

function normalizeLat(lat) {
  if (lat > 90.0) {
    lat = 90.0
  } else if (lat < -90.0) {
    lat = -90.0
  }

  return lat
}

function normalizeLng(lon) {
  while (lon > 180) {
    lon = lon - 360
  }

  while (lon < -180) {
    lon = lon + 360
  }

  return lon
}

function normalizeCoords(lat, lon){
  return [normalizeLat(lat), normalizeLng(lon)]
}

//is what projects our coords into our discrete grid space
function projectionCoords (coords, scale) {
  if (!scale || !coords) {
    throw new Error('missing value')
  }

  let { latSize, lngSize } = cellSizesFromScale(scale)
  let lat = coords[0]
  let lng = coords[1]

  return {
    latIdx: Math.floor((lat - fudgeFactor) / latSize),
    lngIdx: Math.floor((lng - fudgeFactor) / lngSize),
    latSize: Constants.RAW_SAMPLES_LAT_RESOLUTION * scale,
    lngSize: Constants.RAW_SAMPLES_LNG_RESOLUTION * scale
  }
}

function projectionIdxToBounds(latIdx, lngIdx, scale) {
  let { latSize, lngSize } = cellSizesFromScale(scale)

  let south = latIdx * latSize + fudgeFactor
  let north = (latIdx + 1) * latSize + fudgeFactor

  let west = lngIdx * lngSize + fudgeFactor
  let east = (lngIdx + 1) * lngSize + fudgeFactor


  return { south, north, east, west }
}


module.exports = {
  normalizeCoords,
  projectionCoords,
  projectionIdxToBounds,
  normalizeLng,
  normalizeLat,

  combinedBounds: function(bounds1, bounds2) {
    return {
      north: Math.max(bounds1.north, bounds2.north),
      south: Math.min(bounds1.south, bounds2.south),
      east: Math.max(bounds1.east, bounds2.east),
      west: Math.min(bounds1.west, bounds2.west),
    }
  },

  makeChunks: function (arr, size) {
    let chunks = {}

    for(let i = 0; i < arr.length; i++) {
      let chunk = Math.floor(i / size);

      if (!chunks[chunk]) {
        chunks[chunk] = []
      }

      chunks[chunk].push(arr[i]);
    }

    return _.values(chunks)
  },

  areFloatsEqual: function(a, b) {
    return Math.abs(a - b) < .000001
  },

  chainPromises: function (promises) {
    let prom = Promise.resolve(null);

    promises.forEach((p) => {
      prom = prom.then(() => { return p })
    })

    return prom
  },

  fromPointArrayToLatLngLiteral: function (point) {
    return {
      lat: point[0],
      lng: point[1]
    }
  },


  projectLat: function(lat, scale) {
    if (!lat || !scale) {
      throw 'missing'
    }

    let { latSize } = cellSizesFromScale(scale)

    return Math.floor((lat - fudgeFactor) / latSize)
  },

  projectLng: function(lng, scale) {
    if (!lng || !scale) {
      throw 'missing'
    }

    let { lngSize } = cellSizesFromScale(scale)

    return Math.floor((lng - fudgeFactor) / lngSize)
  },
}
