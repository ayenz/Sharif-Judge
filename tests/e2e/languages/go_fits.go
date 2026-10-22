package main

import "fmt"

// about 30 MB, under the 50 MB limit
func main() {
	var a, b int
	fmt.Scan(&a, &b)
	big := make([]byte, 30<<20)
	for i := range big {
		big[i] = 1
	}
	fmt.Println(a + b + int(big[12345]) - 1)
}
