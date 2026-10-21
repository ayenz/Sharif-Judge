# Program penjumlahan khusus
# dibuat sendiri :)


def solve(nums):
    # hitung total
    total = 0
    for n in nums:
        if n % 2 == 0:
            total += n * n  # kuadrat
        else:
            total -= n
    return total


def read_numbers():
    data = input().split()
    return [int(x) for x in data]


def main():
    nums = read_numbers()
    print(solve(nums))


main()
