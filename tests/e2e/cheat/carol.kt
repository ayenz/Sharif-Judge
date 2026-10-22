fun main() {
    val values = generateSequence(::readLine).flatMap { it.split(' ').asSequence() }
        .filter { it.isNotBlank() }.map(String::toLong).toList()
    println(values.sumOf { v -> if (v % 2 == 0L) v * v else -v })
}
