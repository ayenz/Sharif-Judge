func readNumbers() -> [Int] {
    let line = readLine() ?? ""
    return line.split(separator: " ").compactMap { Int($0) }
}

func solve(_ nums: [Int]) -> Int {
    var total = 0
    for n in nums {
        if n % 2 == 0 {
            total += n * n
        } else {
            total -= n
        }
    }
    return total
}

let nums = readNumbers()
print(solve(nums))
