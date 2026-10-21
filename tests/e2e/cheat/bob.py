def ambil_angka():
    isi = input().split()
    return [int(v) for v in isi]


def hitung(arr):
    hasil = 0
    for a in arr:
        if a % 2 == 0:
            hasil += a * a
        else:
            hasil -= a
    return hasil


def main():
    arr = ambil_angka()
    print(hitung(arr))


main()
