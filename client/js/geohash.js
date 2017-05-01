const _ = require('underscore')
const Constants = require('./constants')
const Util = require('./util')
const Q = require('q')

const expect = require('expect.js')

class GeoHash {
  constructor(scale) {
    if (_.isNaN(scale) || !_.isNumber(scale)) {
      throw new Error('invalid scale')
    }

    this.lookup = {}
    this.scale = scale
    this.latSize = Constants.LNG_DEGREES_PER_SCALE * scale
    this.lngSize = Constants.LNG_DEGREES_PER_SCALE * scale
  }

  get(lat, lng) {
    let { latIdx, lngIdx } = Util.projectionCoords([lat,lng], this.scale)
    return this.getByIdx(latIdx, lngIdx)
  }

  getByIdx(latIdx, lngIdx) {
    if (!this.lookup[latIdx]) {
      this.lookup[latIdx] = {}
    }

    if (!this.lookup[latIdx][lngIdx]) {
      this.lookup[latIdx][lngIdx] = []
    }

    return this.lookup[latIdx][lngIdx].slice()
  }

  appendByIdx(_item, latIdx, lngIdx) {
    this._touch(latIdx, lngIdx)
    this.lookup[latIdx][lngIdx].push(_item)
  }

  replace(item, lat, lng) {
    this.clearByCoords(lat, lng)
    this.append(item, lat, lng)
  }

  append(item, lat, lng) {
    let { latIdx, lngIdx } = Util.projectionCoords([lat,lng], this.scale)

    if (!_.isNumber(lat) || !_.isNumber(lng)) {
      throw new Error(`cant append item: ${[lat, lng]}`)
    }

    // hack: it's a bit hacky to mutate this item but i'm in a hurry
    item.lat = lat
    item.lng = lng

    this.appendByIdx(item, latIdx, lngIdx)
  }

  clearAll() {
    this.lookup = {}
  }

  clearByCoords(lat, lng) {
    let { latIdx, lngIdx } = Util.projectionCoords([lat,lng], this.scale)

    this._touch()
    this.lookup[latIdx][lngIdx] = []
  }

  remove(shape) {
    const { lat, lng } = shape
    let { latIdx, lngIdx } = Util.projectionCoords([lat,lng], this.scale)

    this._touch(latIdx, lngIdx)
    this.lookup[latIdx][lngIdx] = _.filter(this.lookup[latIdx][lngIdx], (_shape) => {
      this._compareShapes(shape, _shape)
    })
  }

  // todo: don't hard code this assumption.  allow an equality argument to be defined.
  _compareShapes(s1, s2) {
    return s1._id == s2._id
  }

  _touch(latIdx, lngIdx) {
    if (_.isUndefined(this.lookup[latIdx])) {
      this.lookup[latIdx] = {}
    }

    if (_.isUndefined(this.lookup[latIdx][lngIdx])) {
      this.lookup[latIdx][lngIdx] = []
    }
  }

  getIndexPairs() {
    let pairs = []
    _.each(_.keys(this.lookup), (latIdx) => {
      let byLngIdx = this.lookup[latIdx]

      _.each(_.keys(byLngIdx), (lngIdx) => {
        pairs.push([parseInt(latIdx), parseInt(lngIdx)])
      })
    })

    return pairs
  }

  logicalIntersection(hash2) {
    return _.intersection(this.getIndexPairs(), hash2.getIndexPairs())
  }

  // returns an array of index pairs
  logicalDifference(hash2) {
    let pairs1 = _.sortBy(this.getIndexPairs(), x => x)

    let res = []
    _.each(pairs1, (pair) => {

      if (!hash2.getByIdx(pair[0], pair[1]).length) {
        res.push(pair)
      }
    })

    return res
  }

  all() {
    let pairs = []

    _.each(_.keys(this.lookup), (latIdx) => {
      let byLngIdx = this.lookup[latIdx]
      _.each(_.keys(byLngIdx), (lngIdx) => {
        pairs.push([latIdx, lngIdx])
      })
    })

    return _.map(pairs, (pair) => {
      return this.getByIdx(pair[0], pair[1])
    })
  }
}

GeoHash.forEachCell = function (bounds, scale, fn) {
  let maxLatIdx, minLatIdx, maxLngIdx, minLngIdx
  if (bounds) {
    maxLatIdx = Util.projectLat(bounds.north, scale)
    minLatIdx = Util.projectLat(bounds.south, scale)
    maxLngIdx = Util.projectLng(bounds.east, scale)
    minLngIdx = Util.projectLng(bounds.west, scale)
  }

  if ( _.any([maxLatIdx, minLatIdx, maxLngIdx, minLngIdx], _.isNaN)) {
    console.error('error', [maxLatIdx, minLatIdx, maxLngIdx, minLngIdx])
  }

  //console.log('maxLatIdx, minLatIdx, maxLngIdx, minLngIdx:', maxLatIdx, minLatIdx, maxLngIdx, minLngIdx)

  let calls = []
  for (let i = minLatIdx; i <= maxLatIdx; i++) {
    for (let j = minLngIdx; j <= maxLngIdx; j++) {
      calls.push([i, j])
    }
  }

  calls.forEach(c => fn.apply(c))
}

module.exports = GeoHash
