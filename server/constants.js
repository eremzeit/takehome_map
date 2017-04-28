module.exports = {
  SUPPORTED_SCALES: [1, 4, 32, 64],
  INPUT_FILE_INDEXES: [0, 1, 2, 3],
  COLOR_FILE: '../data/RainColorsV2.csv',
  RAW_SAMPLES_LAT_RESOLUTION: 0.005,
  RAW_SAMPLES_LNG_RESOLUTION: 0.005,
  MONGO_URL: 'mongodb://blag:something_not_so_secret@localhost:27017/climacell_aj',
  SERVER_PORT: 4108
}
