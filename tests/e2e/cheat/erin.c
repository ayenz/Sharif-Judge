#include <stdio.h>

int main(void) {
    long total = 0, n;
    while (scanf("%ld", &n) == 1) {
        if (n % 2 == 0) {
            total += n * n;
        } else {
            total -= n;
        }
    }
    printf("%ld\n", total);
    return 0;
}
