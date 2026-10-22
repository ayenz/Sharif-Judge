fun readNumbers(): List<Long> {
    val line = readln().trim()
    return line.split(Regex("\\s+")).map { it.toLong() }
}

fun solve(nums: List<Long>): Long {
    var total = 0L
    for (n in nums) {
        if (n % 2 == 0L) {
            total += n * n
        } else {
            total -= n
        }
    }
    return total
}

fun main() {
    val nums = readNumbers()
    println(solve(nums))
}
