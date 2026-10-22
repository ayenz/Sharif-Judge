// one short burst of memory outside the heap, then exits quickly
const b = Buffer.alloc(200 * 1024 * 1024, 1)
const [x, y] = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number)
console.log(x + y + b[12345] - 1)
