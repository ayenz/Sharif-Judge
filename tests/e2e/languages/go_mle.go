package main

// keeps growing until it is stopped
func main() {
	var keep [][]byte
	for {
		b := make([]byte, 1<<20)
		for i := range b {
			b[i] = 1
		}
		keep = append(keep, b)
	}
}
