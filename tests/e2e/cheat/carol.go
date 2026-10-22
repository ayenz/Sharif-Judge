package main

import (
	"bufio"
	"fmt"
	"os"
)

func readNumbers() []int {
	reader := bufio.NewReader(os.Stdin)
	var nums []int
	for {
		var n int
		if _, err := fmt.Fscan(reader, &n); err != nil {
			break
		}
		nums = append(nums, n)
	}
	return nums
}

func solve(nums []int) int {
	total := 0
	for _, n := range nums {
		if n%2 == 0 {
			total += n * n
		} else {
			total -= n
		}
	}
	return total
}

func main() {
	nums := readNumbers()
	fmt.Println(solve(nums))
}
