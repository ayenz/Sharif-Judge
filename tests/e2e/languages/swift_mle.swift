// keeps growing until it is stopped
var keep: [[UInt8]] = []
while true { keep.append([UInt8](repeating: 1, count: 1 << 20)) }
