// about 30 MB, under the 50 MB limit
let parts = readLine()!.split(separator: " ").map { Int($0)! }
let big = [UInt8](repeating: 1, count: 30 << 20)
print(parts[0] + parts[1] + Int(big[12345]) - 1)
