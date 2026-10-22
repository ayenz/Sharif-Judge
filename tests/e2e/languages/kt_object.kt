// main inside an object instead of a top-level function
object Solution {
    @JvmStatic
    fun main(args: Array<String>) {
        val (a, b) = readln().trim().split(Regex("\\s+")).map { it.toLong() }
        println(a + b)
    }
}
