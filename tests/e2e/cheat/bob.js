// my solution
const fs = require('fs')

function hitung(daftar) {
  let hasil = 0
  for (const angka of daftar) {
    if (angka % 2 === 0) {
      hasil += angka * angka // even: square
    } else {
      hasil -= angka
    }
  }
  return hasil
}

function bacaAngka() {
  const isi = fs.readFileSync(0, 'utf8').trim().split(/\s+/)
  return isi.map(s => parseInt(s, 10))
}

function main() {
  const daftar = bacaAngka()
  console.log(hitung(daftar))
}

main()
