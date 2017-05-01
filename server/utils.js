function normalizeCoords( lat, lon ){
  lat = parseFloat(lat)
  lon = parseFloat(lon)

  if (lat > 90.0) {
    lat = 90.0
  } else if (lat < -90.0) {
    lat = -90.0
  }

  while (lon > 180) {
    lon = lon - 360
  }

  while (lon < -180) {
    lon = lon + 360
  }

  return [lat, lon]
}

module.exports = {
  normalizeCoords
}
