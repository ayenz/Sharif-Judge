def read_numbers():
    data = input().split()
    return [int(x) for x in data]


def solve(nums):
    total = 0
    for n in nums:
        if n % 2 == 0:
            total += n * n
        else:
            total -= n
    return total


def main():
    nums = read_numbers()
    print(solve(nums))


main()
