import java.util.Scanner;

public class Main {
    static long[] readNumbers(Scanner in) {
        long[] nums = new long[100];
        int count = 0;
        while (in.hasNextLong()) {
            nums[count++] = in.nextLong();
        }
        return java.util.Arrays.copyOf(nums, count);
    }

    static long solve(long[] nums) {
        long total = 0;
        for (long n : nums) {
            if (n % 2 == 0) {
                total += n * n;
            } else {
                total -= n;
            }
        }
        return total;
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        long[] nums = readNumbers(in);
        System.out.println(solve(nums));
    }
}
