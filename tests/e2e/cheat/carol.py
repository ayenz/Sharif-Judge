import sys

values = list(map(int, sys.stdin.read().split()))
print(sum(v * v if v % 2 == 0 else -v for v in values))
