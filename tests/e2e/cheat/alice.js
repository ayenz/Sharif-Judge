const fs = require('fs')

function readNumbers() {
  const data = fs.readFileSync(0, 'utf8').trim().split(/\s+/)
  return data.map(x => parseInt(x, 10))
}

function solve(nums) {
  let total = 0
  for (const n of nums) {
    if (n % 2 === 0) {
      total += n * n
    } else {
      total -= n
    }
  }
  return total
}

function main() {
  const nums = readNumbers()
  console.log(solve(nums))
}

main()
