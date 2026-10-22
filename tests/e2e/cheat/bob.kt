// jawaban saya
fun hitung(daftar: List<Long>): Long {
    var hasil = 0L
    for (x in daftar) {
        if (x % 2 == 0L) {
            hasil += x * x // genap
        } else {
            hasil -= x
        }
    }
    return hasil
}

fun main() {
    val daftar = baca()
    println(hitung(daftar))
}

fun baca(): List<Long> {
    val isi = readln().trim()
    return isi.split(Regex("\\s+")).map { it.toLong() }
}
