package main

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
)

func main() {
	raw, _ := io.ReadAll(os.Stdin)
	sum := 0
	for _, field := range strings.Fields(string(raw)) {
		v, _ := strconv.Atoi(field)
		switch {
		case v%2 == 0:
			sum += v * v
		default:
			sum -= v
		}
	}
	fmt.Println(sum)
}
