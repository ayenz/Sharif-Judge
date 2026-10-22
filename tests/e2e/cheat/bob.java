import java.util.Scanner;

// tugas minggu ini
public class Main {
    static long hitung(long[] daftar) {
        long hasil = 0;
        for (long x : daftar) {
            if (x % 2 == 0) {
                hasil += x * x; // genap
            } else {
                hasil -= x;
            }
        }
        return hasil;
    }

    static long[] baca(Scanner sc) {
        long[] isi = new long[100];
        int jumlah = 0;
        while (sc.hasNextLong()) {
            isi[jumlah++] = sc.nextLong();
        }
        return java.util.Arrays.copyOf(isi, jumlah);
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        long[] daftar = baca(sc);
        System.out.println(hitung(daftar));
    }
}
