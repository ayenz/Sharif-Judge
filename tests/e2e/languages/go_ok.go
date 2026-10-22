package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	r := bufio.NewReader(os.Stdin)
	var a, b int
	fmt.Fscan(r, &a, &b)
	fmt.Println(a + b)
}
