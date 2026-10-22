let parts = readLine()!.split(separator: " ").map { Int($0)! }
print(parts[parts[0] + parts[1] + 10])
