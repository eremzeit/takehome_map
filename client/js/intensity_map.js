const ShapePool = require('./shape_pool')
const _ = require('underscore')
const Q = require('q')
const Util = require('./util')

class IntensityMap {
  constructor() {
    this.googleMap = null
    this.shapePool = null
    this.currentDataLayerId = 0
  }

  init() {
    // technically best practice would be explicitly import global variables
    // rather than letting them bleed into this module from the window object
    this.googleMap = new google.maps.Map(document.getElementById('weather-map'), {
      zoom: 9,
      center: {lat: 42.20, lng: -71.7},
      mapTypeId: 'terrain',
    })

    this.shapePool = new ShapePool(this.googleMap)

    this.googleMap.addListener('bounds_changed', () => {
      IntensityMap.mapUpdatedDebounced(this, 'bounds')
    })

    this.googleMap.addListener('zoom_changed', () => {
      IntensityMap.zoomChangedDebounced(this)
    })

    setTimeout(() => {
      IntensityMap.mapUpdatedDebounced(this, null)
      this.loadShapesInCurrentBounds({updateScale: true})
    }, 1000)

    // change the requested data layer every once in a while
    setInterval(() => {
      this.currentDataLayerId = this.currentDataLayerId + 1
      if (this.currentDataLayerId > 3) {
        this.currentDataLayerId = 0
      }

      IntensityMap.mapUpdatedDebounced(this, null)
      this.loadShapesInCurrentBounds({updateScale: true, dataSetChanged: true})
    }, 8000)
  }

  loadShapesInCurrentBounds(options) {
    console.log('-----Beginning data load')
    options = options || {}

    let bounds = this._getQueryBounds()
    let requestedScale = this._findScaleByMapZoom(this.googleMap.getZoom())

    console.log('Requesting scale ' + requestedScale + ' from ' + this.googleMap.getZoom())
    IntensityMap.fetchShapes(bounds, this.currentDataLayerId, requestedScale).then((shapes) => {

      $('.count').text(this.currentDataLayerId)
      let scale = (shapes[0] || {}).scale;
      console.log('received scale: ', scale)

      if (options.updateScale) {
        this.shapePool.scaleUpdated(scale)
      }

      if (options.dataSetChanged) {
        this.shapePool.clearAllShapes()
      }

      return this.shapePool.dataRefreshedWithBounds(shapes, bounds, scale)
    }).done()
  }

  _findScaleByMapZoom(mapZoom) {
    return ({
      1: 32,
      2: 32,
      3: 16,
      4: 16,
      5: 8,
      6: 8,
      7: 4,
      8: 4,
      9: 4,
      10: 2,
      11: 2,
      12: 2,
      13: 1,
      14: 1,
      15: 1,
      16: 1
    })[mapZoom];
  }

  _getQueryBounds() {
    let bounds = this.googleMap.getBounds().toJSON()

    //todo: uncomment the code below to increase the size of the queried area
    let hFudge = (bounds.east - bounds.west) * 1
    let vFudge = (bounds.north - bounds.south) * 1

    let east = Util.normalizeLng(bounds.east + hFudge)
    let west = Util.normalizeLng(bounds.west - hFudge)
    let north = Util.normalizeLat(bounds.north + vFudge)
    let south = Util.normalizeLat(bounds.south - vFudge)

    console.log('Bounds for query', north, south, east, west, )
    return { east, west, north, south }
  }
}

IntensityMap.zoomChangedDebounced = _.debounce(function(intensityMap) {
  intensityMap.loadShapesInCurrentBounds({updateScale: true})

  //hacky but effectively suppresses that function for the debounce window
  IntensityMap.mapUpdatedDebounced(intensityMap, null)
}, 1);

IntensityMap.mapUpdatedDebounced = _.throttle(function(intensityMap, updateType) {
  if(updateType == 'init') {
    intensityMap.loadShapesInCurrentBounds({updateScale: true})
  } else if(updateType == 'bounds') {
    intensityMap.loadShapesInCurrentBounds({
      updateScale: !intensityMap.shapePool.getCurrentScale()
    })
  }
}, 5000, {leading: true, trailing: true})

IntensityMap.fetchShapes = function(bounds, dataLayerId, scale) {
  let that = this

  let queryPath = [
    Util.normalizeCoords(bounds.north, bounds.west),
    Util.normalizeCoords(bounds.north, bounds.east),
    Util.normalizeCoords(bounds.south, bounds.east),
    Util.normalizeCoords(bounds.south, bounds.west),
    Util.normalizeCoords(bounds.north, bounds.west), //to close the loop
  ]

  let q = {
    layer_id: dataLayerId,
    scale,
    queryPath
  }

  let d = Q.defer()
  $.get({
    url: 'http://localhost:4108/weather',
    data: q,
    success: (shapes) => {
      //console.log('Data scale: ', (shapes[0] || {}).scale, typeof (shapes[0] || {}).scale)
      d.resolve(shapes)
    },

    error: (req, _status, err) => {
      console.error(req, _status, err)
      d.reject(err)
    }
  })

  return d.promise
}

module.exports = IntensityMap
