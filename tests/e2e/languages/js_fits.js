// about 30 MB on the heap, under the 50 MB limit
const a = new Array(3900000).fill(1.5)
const [x, y] = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number)
console.log(x + y + a.length - 3900000)
