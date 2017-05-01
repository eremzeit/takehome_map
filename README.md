# Takehome_map

## Design

- Server
	- Data preloaded and aggregated into multiple levels of resolution so that later queries are fast
	- To prevent too much data from being loaded, when queried for sample values the server will choose a resolution based
		on the bounds you passed in your query.
- Client
  - Chose not to use any front-end framework.  I assumed you were interested more in seeing a performant map.
  - I decided not to use any cool [spatial indexes](https://github.com/mourner/geokdbush) and instead use implement a geo hash from scratch that projects coords from the lat lng space into a discrete grid of buckets.  In retrospect, using one of the libraries would have been much faster and it would have been easier to handle reconciling across different data scales.
  - Uses job lists to manage the asynchronicity of updating the map when new data comes in.


## Continued Work

- TESTS :) I always write tests for production-intended code, but here I tended to skimp for the sake of time.
- To reduce the number of polygons for better performance, I could aggregate adjacent cells that have the same color value into one large polygon region.  On the other hand, it would make the bookkeeping more complex.
- In-flight request canceling.  Right now, if you move the map multiple times in a row, then multiple jobs to update will also happen.  This results in wasted work being done in a number of ways (deserializing the JSON, updating the map objects, etc).  The solution would be to implement a cancel feature where kicking off a new request results in the existing in-flight requests to be cancelled.
- More intelligent data pooling and caching.
  - Right now, moving around causes a refetch of all of the data in the window.  For example, we might fetch smaller portions of the window.
  - I could reduce the typical size of each query by not refetching data from areas that we already have data from.
- There are a couple of places where my bookkeeping is ambiguous and I have to do a full clear of all the shapes. This causes a flicker.  Instead, I need to remove only at the same time as adding new cells, favoring reuse of old cells.

# Running Code

## Server

`cd ./server; npm install; node main.js`

## Client
You should be able to run the code that I already compiled and checked in in the `./public` directory.  Navigate your browser to `http://localhost:4108/`.  Navigate your browser to `http://localhost:4108/`.

If you want to build, I think you can just run'

```
cd ./client
npm install -g browserify
npm install
npm run build

#to dev
npm run watch

#or to run tests
mocha --compilers js:babel-core/register
```
