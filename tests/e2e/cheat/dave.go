package main

import (
	"bufio"
	"fmt"
	"os"
)

// hitung menjumlahkan kuadrat bilangan genap dan mengurangi bilangan ganjil
func hitung(daftar []int) int {
	hasil := 0
	for _, x := range daftar {
		if x%2 == 0 {
			hasil += x * x
		} else {
			hasil -= x
		}
	}
	return hasil
}

func main() {
	daftar := bacaInput()
	fmt.Println(hitung(daftar))
}

func bacaInput() []int {
	r := bufio.NewReader(os.Stdin)
	var daftar []int
	for {
		var x int
		if _, err := fmt.Fscan(r, &x); err != nil {
			break
		}
		daftar = append(daftar, x)
	}
	return daftar
}
