#include <stdio.h>
int main(void) { volatile long x = 0; for (;;) x++; return 0; }
