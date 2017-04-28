function initMap() {
  let map = new IntensityMap();
  map.init();
}

function IntensityMap() {
  this.googleMap = null;
  this.drawnShapes = null;

  //this.cellsPayload = {
  //  cells: [{
  //    east: 0,
  //    west: 0,
  //    north: 0,
  //    south: 0,
  //    center: 0,
  //  }],
  //}
}

IntensityMap.prototype.init = function() {
  let that = this
  this.googleMap = new google.maps.Map(document.getElementById('weather-map'), {
    zoom: 10,
    center: {lat: rawSamples[0][0], lng: rawSamples[0][1]},
    mapTypeId: 'terrain'
  });

  // on the bounds change, trigger a request for data
  this.googleMap.addListener('bounds_changed', function() {
    that.boundsChanged()
    // request data from server in batches
    // downsample based on zoom level
    // render cells in batches
    //    get list of existing overlapping cells
    //    remove those items with bounds that are incorrect
    //    update those items with intensities that are incorrect
    //    add new items
  });

  this.googleMap.addListener('tilesloaded', function() {});

  setTimeout(function() {
    that.reloadShapes();
  }, 1000)
}

IntensityMap.prototype.boundsChanged = _.throttle(function() {
  console.log('bounds: ', this.googleMap.getBounds().toJSON())


}, 3000)

IntensityMap.prototype.renderCells = function(cellsPayload, renderOptions) {
  let that = this;
  this._renderBatches(downsample(cellsPayload), {}).done();
}

IntensityMap.prototype._renderBatches = function(cellsPayload, renderOptions) {
  let that = this;
  let chunks = makeChunks(cellsPayload.cells, 100);
  //let promises = _.map(chunks, function(cells) {
  //    return that._renderCellChunk(cells, renderOptions);
  //});
  //Q.all(promises).done();

  let p = Q.resolve(null);
  _.each(chunks, function(cells) {
    p = p.then(function() {
      return that._renderCellChunk(cells, renderOptions);
    })
  })

  return p
}

IntensityMap.prototype.renderCell = function(cell, renderOptions) {
  renderOptions = renderOptions || {};

  //TODO: check to see if we need to remove any particular polygon firsta
  let points = IntensityMap.cellToPoints(cell);

  let color = IntensityMap.intensityToColor(cell.intensity);
  //if (!color) {
  //  color = '#0000ff';
  //}
  let shouldRender = _.isNumber(cell.intensity) && color;

  if (shouldRender) {
    let options = Object.assign({
      path: points,
      fillColor: color,
      fillOpacity: 0.2,
      strokeColor: color,
      strokeOpacity: 0.0,
      strokeWeight: 1
    }, renderOptions);

    let shape = new google.maps.Polygon(options);

    shape.setMap(this.googleMap);
  }
}

IntensityMap.prototype._renderCellChunk = function(cells, renderOptions) {
  let that = this;

  return Q.delay(1).then(function() {
    for (let j = 0; j < cells.length; j++) {
      that.renderCell(cells[j], renderOptions);
    }
  }).fail(function(err) {
    console.log('Error while rendering cell chunk', err)
    throw err;
  })
}

IntensityMap.prototype.reloadShapes = function() {
  let that = this;
  let queryBounds = this.googleMap.getBounds();
  console.log('query bounds: ', queryBounds)

  IntensityMap.fetchCells(queryBounds.toJSON()).then(function(cellsPayload) {
    that.renderCells(cellsPayload);
  }).catch(function(err) {
    throw err;
  });
}

IntensityMap.intensityToColor = function(intensity) {
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

IntensityMap.prototype.clearShapes = function() {
  if (this.drawnShapes && this.drawnShapes.length) {
    // remove previous shapes
    this.drawnShapes.forEach(function(shape) {
      shape.setMap(null);
    });
  }
}

IntensityMap.fetchCells = function(bounds) {
  let that = this;
  let q = {
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west,
    layer_id: 0
  }

  $.get({
    url: 'http://localhost:4108/weather',
    data: q,
    success: (res) => {
      console.log('data:', res)
    },

    error: (req, _status, err) => {
      console.error(req, _status, err)
    }
  });

  return new Promise(function(resolve, reject) {
    let newCellsPayload = fakeServerData();
    resolve(newCellsPayload);
  });
};

IntensityMap.cellToPoints = function(latLngBounds) {
  //let latPadding = (latLngBounds.north - latLngBounds.south) * 0.05;
  //let lngPadding = (latLngBounds.east - latLngBounds.west) * 0.05;
  let latPadding = 0
  let lngPadding = 0
  let points = [
    {lat: latLngBounds.north - latPadding, lng: latLngBounds.west + lngPadding},
    {lat: latLngBounds.north - latPadding, lng: latLngBounds.east - lngPadding},
    {lat: latLngBounds.south + latPadding, lng: latLngBounds.east - lngPadding},
    {lat: latLngBounds.south + latPadding, lng: latLngBounds.west + lngPadding},
  ];

  return points;
}

function makeChunks(arr, size) {
  let chunks = {}

  for(let i = 0; i < arr.length; i++) {
    let chunk = Math.floor(i / size);

    if (!chunks[chunk]) {
      chunks[chunk] = []
    }

    chunks[chunk].push(arr[i]);
  }

  return _.values(chunks)
}

function toHex (c) {
  var hex = parseInt(c).toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function toHexString(r, g, b) {
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

//function combineCells(cells, center, latSize, lngSize) {
//  let centerLat = parseFloat(center[0]);
//  let centerLng = parseFloat(center[1]);
//
//  return {
//    north: centerLat + latSize / 2,
//    south: centerLat - latSize / 2,
//    east: centerLng + lngSize / 2,
//    west: centerLng - lngSize / 2,
//
//    // Here I use the max of the intensity when aggregating neighbors, but
//    // there are pros and cons to this.  Better product experience would be
//    // to allow the user to choose how they want their data to be aggregated.
//    intensity: _.max(cells, function(c) {return c.intensity}).intensity,
//  }
//}
//
function areFloatsEqual(a, b) {
  return Math.abs(a - b) < .000001
}
