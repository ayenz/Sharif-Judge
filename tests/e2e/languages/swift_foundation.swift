import Foundation

let line = readLine()!.trimmingCharacters(in: .whitespaces)
let nums = line.components(separatedBy: " ").compactMap { Int($0) }
print(nums.reduce(0, +))
