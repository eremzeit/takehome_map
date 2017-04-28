const MongoClient = require('mongodb').MongoClient

const Constants = require('./constants')

// Connection URL
let url = 'mongodb://blag:something_not_so_secret@localhost:27017/climacell_aj'

let ready = new Promise(function(resolve, reject) {
  MongoClient.connect(url, function(err, db) {
    console.log("Connected successfully to server");
    resolve(db)
  });
})

function resetDb() {
  return dbService.ready.then((db) => {
    return db.dropDatabase().then(() => {
      let coll = db.collection('agg_samples') // just put them all in the same collection
      return db.collection('agg_samples').createIndex({loc: '2dsphere', scale: 1}, {})
    })
  })
}

module.exports = {
  ready,
  resetDb,
}
