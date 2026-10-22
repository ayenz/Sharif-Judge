package main

// container/ring is not in the image's build cache, so it is compiled during the build
import (
	"container/ring"
	"fmt"
)

func main() {
	var a, b int
	fmt.Scan(&a, &b)
	r := ring.New(2)
	r.Value = a
	r.Next().Value = b
	sum := 0
	r.Do(func(v any) { sum += v.(int) })
	fmt.Println(sum)
}
