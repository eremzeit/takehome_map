/*
 * shape_pool.js
 *
 * Manages all of the geospatial bookkeeping and heuristics that
 * is required for dynamically changing map of data.
 *
 */

const Constants = require('./constants')
const GeoHash = require('./geohash')
const Util = require('./util')

const Q = require('q')
const _ = require('underscore')

class ShapePool {
  constructor(googleMap, options) {
    this.options = options
    this.googleMap = googleMap
    this.__geoHashByScale = {}
    this.__currentScale = null;

    this.taskQueue = []
  }

  scaleUpdated(newScale) {
    if (this.__currentScale !== newScale) {
      if (this.__currentScale && this.__currentScale < newScale) {
        // due to some bookkeeping issues, we manually have to trigger this
        this.clearAllShapes(newScale)
      }

      this.__currentScale = newScale
    }
  }

  getCurrentScale() {
    return this.__currentScale
  }

  dataRefreshedWithBounds(shapes, bounds, scale) {
    console.log('Updating shape pool with new data: ', shapes.length)

    //sanity check in case some later job somehow changed the zoom and invalidated this one
    if (this.__currentScale !== scale) {
      console.log('ignoring due to scale change', this.__currentScale, scale)
      return
    }

    if (!shapes.length) { return Q.resolve(); }

    let { latSize, lngSize } = shapes[0];

    let newItemsHash = new GeoHash(scale)
    shapes.forEach((shape) => {
      newItemsHash.append(shape, shape.center[0], shape.center[1])
    })

    // find the ones that need to be removed
    let indexPairs = this.getHash(scale).logicalDifference(newItemsHash)
    let toRemove = _.chain(indexPairs).map((pair) => {
      return this.getHash(scale).getByIdx(pair[0], pair[1])
    }).value()

    // now convert those lists into tasks
    console.log('toRemove: ', toRemove.length)
    //toRemove = _.map(toRemove, (shapes) => {
    //  return {
    //    type: 'remove',
    //    shapes: shapes,
    //    task: () => {
    //      return this.remove(shapes, scale);
    //    },
    //  }
    //})

    return this.update(shapes, {}, scale).then(() => {
      return this.remove(toRemove, scale)
    })

    //this.taskQueue = this.taskQueue.concat(toRemove)
    //this.taskQueue = this.taskQueue.concat(toUpdate)
    //return this.flushTaskQueue()
  }

  update(shapes, renderOptions, scale) {
    if (!_.isArray(shapes)) {
      shapes = [shapes];
    }

    if (shapes.length == 0) {
      return
    }

    if (!scale || _.isNaN(scale)) {
      console.log(shapes, this.__currentScale)
      throw 'invalid ' + scale
    }

    if (this.__currentScale !== scale) {
      //console.log('scale diff: ', this.__currentScale, scale)
      //this means our job is outdated and we should give up
      return
    }

    console.log('updateing: ', shapes.length)

    let chunks = Util.makeChunks(shapes, 5000);
    renderOptions = renderOptions || {}

    // Each do each chunk in a separate job
    let promises = _.map(chunks, (shapes) => {
      return Q.delay(0).then(() => {
        for (let j = 0; j < shapes.length; j++) {
          this.insertShape(shapes[j], scale, renderOptions);
        }
      })
    })

    return Util.chainPromises(promises)
  }

  insertShape(shape, scale, renderOptions) {
    if (!shape.scale) {
      throw new Error('missing scale')
    }

    renderOptions = renderOptions || {}

    let path = _.map(shape.loc.coordinates, p => Util.fromPointArrayToLatLngLiteral(p))
    let options = Object.assign({}, Constants.DEFAULT_SHAPE_OPTIONS, renderOptions, {
      path: path,
      fillColor: shape.color,
      //fillColor: ['#0000ff', '#00ffff', '#77ff00', '#7733ff'][shape.dataLayerId],
      strokeColor: shape.color,

    })

    // the old shape object
    let toUpdate = _.first(this.getHash(scale).get(shape.center[0], shape.center[1]).slice())

    let oldGoogleMapObject
    if (toUpdate) {
      // the google map object needs to be the same but we can replace the object in our cache
      oldGoogleMapObject = toUpdate.googleMapObject
      toUpdate.googleMapObject = null
    }

    let googleMapObject
    if (oldGoogleMapObject) {
      //options.fillColor = '#ffff00'
      oldGoogleMapObject.setOptions(options)
      googleMapObject = oldGoogleMapObject
    } else {
      let gShape = new google.maps.Polygon(options)
      googleMapObject = gShape
      gShape.setMap(this.googleMap)
    }

    shape.googleMapObject = googleMapObject

    // remove items at every data scale
    //this.allAtLatLng(shape.center[0], shape.center[1]).forEach((shape) => {
    this.allAtLatLng(shape.center[0], shape.center[1]).forEach((shape) => {
      if (!toUpdate || shape._id != toUpdate._id) {
        this.remove(shape, shape.scale)
      }
    })

    this.getHash(scale).replace(shape, shape.center[0], shape.center[1])
  }

  remove(shapes, scale) {
    if (!_.isNumber(scale)) {
      throw new Error('must pass scale: ', scale)
    }

    if (!_.isArray(shapes)) {
      shapes = [shapes];
    }

    shapes.forEach((shape) => {
      if (shape.googleMapObject) {
        shape.googleMapObject.setVisible(false);
        shape.googleMapObject.setMap(null);
      }

      this.getHash(scale).remove(shape, scale)
    });

    return Promise.resolve(null)
  }

  //update(oldShapes, newShapes, scale){
  //  let that = this;

  //  // TODO: we could speed things up by keeping the polygon but changing the color
  //  return this.remove(oldShapes, scale).then(() => {

  //    //if (this.__currentScale == scale) {
  //    //  return this.add(newShapes, {}, scale);
  //    //}

  //  })

  //  //let options = Object.assign({}, DEFAULT_SHAPE_OPTIONS, renderOptions, {
  //  //  fillColor: newShape.color,
  //  //  strokeColor: newShape.color,
  //  //});

  //  //let oldGoogleMapObject = oldShape.googleMapObject
  //  //if (oldGoogleMapObject) {
  //  //  // the google map object needs to be the same but we can replace the object in our cache
  //  //  oldGoogleMapObject.setOptions(options)
  //  //  newShape.googleMapObject = oldGoogleMapObject;
  //  //  that.shapesPool.clear(oldShape.lat, oldShape.lng);
  //  //  that.shapesPool.append(newShape, oldShape.lat, oldShape.lng);
  //  //} else {
  //  //  throw new Error('Shape in pool is missing a google shape object')
  //  //}
  //}

  clearAllShapes(scale) {
    let shapes = this.allShapes()

    _.chain(shapes).each((s) => {
      this.remove(s, s.scale);
    })
  }

  getHash(scale) {
    if (!this.__geoHashByScale[scale]) {
      this.__geoHashByScale[scale] = new GeoHash(scale);
    }

    return this.__geoHashByScale[scale]
  }

  allShapes() {
    let r =  _.chain(this.__geoHashByScale).values().map((geoHash) => {
      return geoHash.all()
    }).flatten().value()

    return r
  }

  // A heuristic at best since lat longs are inherently a 3d unit
  latLngDistance(point1, point2) {
    if (!point1 || !point2) {
      throw new Error('invalid params')
    }

    let aSqrd = Math.pow(point2[0] - point1[0], 2)
    let bSqrd = Math.pow(point2[1] - point1[1], 2)
    return Math.pow(aSqrd + bSqrd, .5)
  }

  //
  allAtLatLng(lat, lng) {
    return _.chain(this.__geoHashByScale).pairs().map((pair) => {
      let scale = pair[0]
      let hash = pair[1]

      return hash.get(lat, lng, scale)
    }).flatten().value()
  }

  allShapesRelatedTo(lat, lng) {
    let scales = _.chain(this.__geoHashByScale).keys().map(scale => parseInt(scale)).value()
    let largestScale = _.max(scales)
    let { latIdx, lngIdx } = Util.projectionCoords([lat,lng], largestScale)

    let shapes = []
    scales.forEach((scale) => {
      let bounds = Util.projectionIdxToBounds(latIdx, lngIdx, scale)
      console.log('bounds: ', bounds)
      GeoHash.forEachCell(bounds, scale, (i, j) => {
        shapes = shapes.concat(this.getHash(scale).getByIdx(i, j))
      })
    })

    return shapes
  }

  allStillRendered() {
    return _.chain(this.allShapes()).filter((shape) => {
      //console.log('shape.googleMapObject:', shape.googleMapObject)
      return shape.googleMapObject.visible || shape.googleMapObject.map
    }).groupBy(x => x.scale).value()
  }

  _flashBounds(bounds) {
    let { north, south, east, west } = bounds
    let path = [
      [north, west],
      [north, east],
      [south, east],
      [south, west],
    ]

    path = _.map(path, p => Util.fromPointArrayToLatLngLiteral(p))

    let options = Object.assign({}, Constants.DEFAULT_SHAPE_OPTIONS, {
      path: path,
      fillOpacity: 0,
      strokeColor: '#ff0000',
      strokeOpacity: 0.5
    })

    let gShape = new google.maps.Polygon(options)
    gShape.setMap(this.googleMap)

    setTimeout(() => {
      gShape.setMap(null)
    }, 2000)
  }
}

module.exports = ShapePool

