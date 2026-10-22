package main

import "fmt"

func main() {
	var a, b int
	fmt.Scan(&a, &b)
	s := []int{a, b}
	fmt.Println(s[a+b+10])
}
