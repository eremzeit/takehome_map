const IntensityMap = require('./intensity_map');

window.initMap = function() {
  let map = new IntensityMap();
  map.init();
  window.map = map;
}
