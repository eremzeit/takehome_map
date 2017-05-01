module.exports = {
  // Degress per scale seems like a wonky way of thinking about it, but
  // it allows me to pass only one value (scale) while sorta retaining
  // the ability to have non-square cells
  LAT_DEGREES_PER_SCALE: 0.005,
  LNG_DEGREES_PER_SCALE: 0.005,

  // Determines how far out of the visible window that we
  // are loading data
  LOAD_MARGIN_RATIO_HORIZ: .5,
  LOAD_MARGIN_RATIO_VERT: 1,

  DEFAULT_SHAPE_OPTIONS: {
    fillOpacity: 0.2,
    strokeOpacity: 0.0,
    strokeWeight: 1
  }
}
