#include <stdio.h>
#include <string.h>
int main(void) { char s[1001]; if (!fgets(s, sizeof s, stdin)) return 0; int n = strlen(s); while (n && (s[n-1] == '\n' || s[n-1] == '\r')) n--; for (int i = n - 1; i >= 0; i--) putchar(s[i]); putchar('\n'); return 0; }
