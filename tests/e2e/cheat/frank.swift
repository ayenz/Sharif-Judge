var sum = 0
while let line = readLine() {
    for token in line.split(whereSeparator: { $0 == " " }) {
        guard let v = Int(token) else { continue }
        sum += v.isMultiple(of: 2) ? v * v : -v
    }
}
print(sum)
