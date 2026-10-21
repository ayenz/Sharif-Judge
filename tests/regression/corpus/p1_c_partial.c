#include <stdio.h>
int main(void) { long a, b; scanf("%ld %ld", &a, &b); printf("%ld\n", a < 10 ? a + b : 0); return 0; }
