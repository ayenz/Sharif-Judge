import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.StringTokenizer;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder all = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) all.append(line).append(' ');
        StringTokenizer st = new StringTokenizer(all.toString());
        long sum = 0;
        while (st.hasMoreTokens()) {
            long v = Long.parseLong(st.nextToken());
            sum += (v % 2 == 0) ? v * v : -v;
        }
        System.out.println(sum);
    }
}
