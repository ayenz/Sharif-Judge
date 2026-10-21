#include <stdio.h>

int main(void) {
    long hasil = 0, x;
    while (scanf("%ld", &x) == 1) {
        if (x % 2 == 0) {
            hasil = hasil + x * x;
        } else {
            hasil = hasil - x;
        }
    }
    printf("%ld\n", hasil);
    return 0;
}
