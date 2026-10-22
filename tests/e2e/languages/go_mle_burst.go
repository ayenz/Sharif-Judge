package main

import "fmt"

// one short burst of 200 MB, then exits quickly
func main() {
	var a, b int
	fmt.Scan(&a, &b)
	big := make([]byte, 200<<20)
	for i := range big {
		big[i] = 1
	}
	fmt.Println(a + b + int(big[12345]) - 1)
}
