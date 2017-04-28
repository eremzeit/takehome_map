const _ = require('underscore')
const express = require('express');
const app = express();

const Model = require('./model')
const Constants = require('./constants')

function configureServer() {
  app.use(express.static('../public'))

  app.get('/weather', function(req, res) {
    let params = _.chain(req.query)
      .pick('east', 'west', 'north', 'south')
      .mapObject((val, key) => {
        return parseFloat(val);
      }).value()

    params.layer_id = parseInt(req.query.layer_id)

    Model.queryPoints(params.north, params.south, params.east, params.west, params.layer_id).then((points) => {
      points = points || []
      console.log('points.length:', points.length)
      console.log('kb:', JSON.stringify(points).length / 1000)
      res.json(points)
    }).catch((err) => {
      console.log(err)
    })
  })

  app.listen(Constants.SERVER_PORT)
  console.log('Server listening at ' + Constants.SERVER_PORT)
}

function initDataPoints() {
  return Model.initData()
}

initDataPoints().then(() => {
  configureServer()
})
