const expect = require('expect.js')
const GeoHash = require('../js/geohash')

describe('GeoHash', () => {
  let hash
  beforeEach(() => {
    hash = new GeoHash(1)
  })

  describe('get()', () => {
    it('returns an empty list if no items are in that bucket', function() {
      expect(hash.get(40, -23)).to.eql([])
    })

    it('gets all that were appended', function() {
      let x = {a:1}
      let y = {a:2}
      hash.append(x, 40, -23)
      hash.append(y, 40, -23)
      expect(hash.get(40, -23)).to.eql([x, y])
    });
  });

  describe('all()', () => {
    it('returns the correct number of pairs', () => {
      let a = {a:1}
      hash = new GeoHash(1)

      let x = 0
      for (let i = 0; i < 10; i++) {
        for (let j = -10; j < 0; j++) {
          expect(hash.getByIdx(i, j).length).to.eql(0)
          hash.appendByIdx(a, i, j)
          expect(hash.getByIdx(i, j).length).to.eql(1)
          x = x + 1
        }
      }

      expect(hash.all().length).to.eql(x)
    })

  })

  describe('getIndexPairs()', () => {
    it('returns the correct number of pairs', () => {
      hash = new GeoHash(1)
      let a = {a:1}

      let x = 0
      for (let i = 0; i < 10; i++) {
        for (let j = -10; j < 0; j++) {
          hash.appendByIdx(a, i, j)
          x = x + 1
        }
      }

      let pairs = hash.getIndexPairs()
      expect(pairs.length).to.eql(x)
    })
  })

  describe('logicalDifference()', () => {
    it('returns all the items if the 2nd hash is empty', function() {
      for (let i = 0; i < 10; i++) {
        for (let j = -10; j < 0; j++) {
          hash.appendByIdx({foo:1}, i, j)
        }
      }

      let newHash = new GeoHash(1)
      let pairs = hash.logicalDifference(newHash)

      expect(hash.getIndexPairs().length).to.eql(100)
      expect(pairs.length).to.eql(100)
    })

    it('returns empty if the second covers the first', function() {
      let newHash = new GeoHash(1)

      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          hash.appendByIdx({foo:1}, i, j)
          newHash.appendByIdx({foo:1}, i, j)
        }
      }

      let pairs = hash.logicalDifference(newHash)

      //expect(hash.getIndexPairs().length).to.eql(25)
      expect(pairs.length).to.eql(0)
    })

    it('returns a subset of items if there is overlap', function() {
      let newHash = new GeoHash(1)

      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          hash.appendByIdx({foo:1}, i, j)

          if (j == 0) {
            newHash.appendByIdx({foo:1}, i, j)
          }
        }
      }

      let pairs = hash.logicalDifference(newHash)

      //expect(hash.getIndexPairs().length).to.eql(25)
      expect(pairs.length).to.eql(20)
    })
  })

  describe('logicalIntersection()', () => {
    it('returns none the items if the 2nd hash is empty', function() {
      for (let i = 0; i < 10; i++) {
        for (let j = -10; j < 0; j++) {
          hash.appendByIdx({foo:1}, i, j)
        }
      }

      let newHash = new GeoHash(1)
      let pairs = hash.logicalIntersection(newHash)

      expect(hash.getIndexPairs().length).to.eql(100)
      expect(pairs.length).to.eql(0)
    })

    it('returns a subset of items if there is overlap', function() {
      let newHash = new GeoHash(1)

      for (let i = 0; i < 10; i++) {
        for (let j = -10; j < 0; j++) {
          hash.appendByIdx({foo:1}, i, j)

          if (j == 0) {
            newHash.appendByIdx({foo:1}, i, j)
          }
        }
      }

      let pairs = hash.logicalDifference(newHash)

      expect(hash.getIndexPairs().length).to.eql(100)
      expect(pairs.length).to.eql(100)
    })
  })
})
