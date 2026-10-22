// keeps growing the JavaScript heap: stopped by --max-old-space-size
const keep = []
for (;;) keep.push(new Array(100000).fill(Math.random()))
