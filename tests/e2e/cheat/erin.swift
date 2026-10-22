// tugas
func hitung(_ daftar: [Int]) -> Int {
    var hasil = 0
    for x in daftar {
        if x % 2 == 0 {
            hasil += x * x // genap
        } else {
            hasil -= x
        }
    }
    return hasil
}

func baca() -> [Int] {
    let isi = readLine() ?? ""
    return isi.split(separator: " ").compactMap { Int($0) }
}

let daftar = baca()
print(hitung(daftar))
