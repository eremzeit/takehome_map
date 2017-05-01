const _ = require('underscore')
const express = require('express');
const app = express();

const Model = require('./model')
const Constants = require('./constants')
const Util = require('./utils')

function configureServer() {
  app.use(express.static('../public'))

  app.get('/weather', function(req, res) {
    let layerId = parseInt(req.query.layer_id)
    let scale = parseInt(req.query.scale)

    //normalize the coords to make sure they fit the range we'd expect
    let boundingArea = req.query.queryPath.map((x) => {
      return Util.normalizeCoords(x[0], x[1])
    })

    Model.queryPointsAndMakeShapes(boundingArea, layerId, scale).then((shapes) => {
      shapes = shapes || []
      console.log('points.length:', shapes.length)
      console.log('kb:', JSON.stringify(shapes).length / 1000)
      res.json(shapes)
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
