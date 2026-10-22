// Built once in the image (docker/web.Dockerfile) to fill the Go build cache with the
// standard packages submissions commonly import. tester.sh copies that cache into each
// submission's jail, so a typical build takes a fraction of a second instead of seconds.
// Packages not listed here still work; they are just compiled during the submission's build.
package main

import (
	"bufio"
	"bytes"
	"cmp"
	"container/heap"
	"container/list"
	"errors"
	"fmt"
	"maps"
	"math"
	"math/big"
	"math/bits"
	"os"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

var (
	_ = bufio.NewReader
	_ = bytes.Equal
	_ = cmp.Compare[int]
	_ = heap.Init
	_ = list.New
	_ = errors.New
	_ = maps.Keys[map[int]int]
	_ = math.Sqrt
	_ = big.NewInt
	_ = bits.OnesCount
	_ = regexp.MustCompile
	_ = slices.Sort[[]int]
	_ = sort.Ints
	_ = strconv.Itoa
	_ = strings.Fields
	_ = time.Now
	_ = unicode.IsDigit
)

func main() {
	fmt.Fprintln(os.Stdout, "ok")
}
