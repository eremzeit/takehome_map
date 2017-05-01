/*
 * Misc import functions
 */

const Q = require('q')
const jsonfile = require('jsonfile')
const fs = require('fs')
const _ = require('underscore')
const dbService = require('./db')
//const Model = require('./model')
const Constants = require('./constants')

/*
 * Returns a promise that yields an array of arrays of samples
 */
function readAllSamplesAllFiles() {
  let filePromises = Constants.INPUT_FILE_INDEXES.map((i) => {
    return getSamplesFromFile(i)
  })

  return Promise.all(filePromises)
}


function getSamplesFromFile(fileIndex) {
  return new Promise((resolve, reject) => {
    let filePath = `../data/json${fileIndex}.json`

    jsonfile.readFile(filePath, function(err, obj) {
        console.log('Samples read: ' + obj.length)

        if (err) {
          reject(err)
        } else {
          let items = obj.map((sample) => {
            let intensity = parseFloat(sample['intensity'])
            intensity = isNaN(intensity) ? 0 : intensity

            let lat = parseFloat(sample['Latitude'])
            let lng = parseFloat(sample['Longitude'])

            let point = makePointGeoJSON(lat, lng)
            return Object.assign(point, {
              intensity: intensity,
            })
          })

          resolve(items)
        }
    })
  })
}

// just make sure that the samples have what i would expect them to have based on browsing
function describeSamples(samples) {
  let latMin = _.min(samples, (s) => s[0])[0];
  let latMax = _.max(samples, (s) => s[0])[0];
  let lngMin = _.min(samples, (s) => s[1])[1];
  let lngMax = _.max(samples, (s) => s[1])[1];

  let latBounds = [latMin, latMax]
  let lonBounds = [lngMin, lngMax]

  console.log('Lat bounds: ' + latBounds)
  console.log('Lng bounds: ' + lonBounds)

  _.chain(samples).groupBy(s => s[0] + ',' + s[1]).pairs().tap((pairs)=> {
    console.log('uniques: ', pairs.length);
  }).filter((pair) => {
    return pair[1].length > 1;
  }).tap((pairs) => {
    console.log('dups: ', pairs);
  });

  // check lat interval
  let lats = _.chain(samples).map((s) => { return s[0] }).uniq().sort().value()
  let prevDiff = null
  for (let i = 0; i < lats.length + 1; i++) {
    let diff = lats[i+1] - lats[i];

    let isSame = Math.abs(prevDiff - diff) < 0.00001
    if (prevDiff != null && !_.isNaN(diff) && !isSame) {
      throw 'interval different: ' + prevDiff + ',' + diff
    }

    prevDiff = diff
  }

  //check lng interval
  let lngs = _.chain(samples).map((s) => { return s[1] }).uniq().sort().value()
  for (let i = 0; i < lngs.length - 2; i++) {
    let diff = lngs[i+1] - lngs[i];
    let isSame = Math.abs(prevDiff - diff) < 0.00001

    if (!isSame && prevDiff != null && !_.isNaN(prevDiff)) {
      throw 'lng interval different: ' + prevDiff + ',' + diff
    }

    prevDiff = diff
  }
}

function _readColorValues() {
  return new Promise((resolve, reject) => {
    let file = fs.readFileSync(COLOR_FILE, {encoding: 'utf8'})
    let lines = file.split(/[\n\r]+/).slice(1)

    let res = lines.map((line) => {
      let items = line.split(/;/)
      let rgb = [items[0], items[1], items[2]]
      let thresh = parseFloat(items[3]);

      return [thresh, rgb]
    })

    return res
  })
}

function makePointGeoJSON(lat, lng) {
  return {
    loc: {
      coordinates: [lat, lng],
      type: 'Point'
    }
  }
}



module.exports = {
  readAllSamplesAllFiles: readAllSamplesAllFiles
}
