fun main() {
    val (a, b) = readln().trim().split(Regex("\\s+")).map { it.toLong() }
    println(a + b)
}
