# Assignments and problems

Head instructors and admins create assignments on **Assignments > Add assignment**.

## The assignment

| Field | Meaning |
|---|---|
| Name | Up to 50 characters |
| Start, finish | Submissions are accepted from start until finish + extra time |
| Extra time | Minutes, or a product such as `48*60` (two days). Submissions in the extra time get a late coefficient |
| Participants | `ALL`, or a comma-separated list of usernames |
| Late rule | Computes the coefficient (see below) |
| Open | Students can only submit while the assignment is open |
| Scoreboard | Show the scoreboard to everybody |
| Java exceptions | Show the Java exception name to students on a runtime error |
| Archived | Hidden from the dashboard calendar; still listed |

## Problems

Each problem has a name, a score, time limits for C/C++ (also used for Go), Python and Java (also
used for JavaScript) in milliseconds, a memory
limit (kB), the allowed languages, and how output is compared. **Upload only** problems are not judged:
students upload a file (PDF, zip, txt or code) and it is final immediately.

Defaults for a new problem: score 100, 500 ms / 1500 ms / 2000 ms, 50000 kB, `diff -bB`.

### Comparing output

| Diff command | Argument | Result |
|---|---|---|
| `diff` | `-bB` (default) | Ignore changes in the amount of whitespace and blank lines |
| `diff` | `-iw` (any `diff` options) | As `diff` with those options |
| `diff` | `ignore` | Remove all whitespace and newlines from both outputs, then compare |
| `diff` | `identical` | Byte-for-byte identical |

For problems with several correct answers, add a **custom tester** (`tester.cpp`, below).

## Test cases and descriptions (zip)

Upload a zip with one folder per problem:

```
p1/
  in/input1.txt     # stdin of test 1
  in/input2.txt
  out/output1.txt   # expected stdout of test 1
  out/output2.txt
  desc.md           # description in Markdown (or desc.html)
  statement.pdf     # optional problem PDF
  tester.cpp        # optional custom tester
p2/
  ...
assignment.pdf      # optional PDF for the whole assignment
```

Only `txt`, `cpp`, `html`, `md` and `pdf` files are extracted. Uploading a new zip replaces the test
cases and descriptions of the problems it contains. The score of a submission is the share of test
cases it passes: 3 of 4 tests = 75% of the problem score.

### Custom tester

`tester.cpp` is compiled once (`g++ -O2`) and called for every test as

```
shj_tester <input file> <expected output file> <program output file>
```

Exit code `0` accepts the test; anything else rejects it.

## Late rule

The rule decides the coefficient (0–100, percent of the score kept) from `$delay`, the seconds after
the finish time (negative before it), and `$extra_time`, the extra time in seconds. It uses the PHP
syntax of the original SharIF Judge, so rules from a PHP installation keep working:

```php
if ($delay <= 0)
  $coefficient = 100;                                   // on time
elseif ($delay <= 3600)
  $coefficient = ceil(100 - ((30 * $delay) / 3600));    // first hour: 100 → 70
elseif ($delay <= 86400)
  $coefficient = 70;                                    // rest of day one
else
  $coefficient = 0;
```

Available: `if`/`elseif`/`else`, arithmetic, comparisons, `and`/`or`, `ceil`, `floor`, `round`, `abs`,
`min`, `max`, `intval`. A rule that does not compile is rejected when you save; the assignments list
shows `error` as the coefficient when a rule fails at run time. When you change the times or the rule
of an assignment, the coefficients of all its submissions are recomputed.

## Descriptions

Problem descriptions are edited on the problem page (head instructors): **Markdown** with a live
preview, **rich text**, or **HTML source**. PDFs come from the zip; students can open them only while
the assignment is open for them.

## Downloads

From the assignment's menu: **Export (tests + settings)**, and the final submissions as a zip grouped
by user or by problem. Submissions also export to Excel from the submissions pages.

## Reusing an assignment (export and import)

**Export (tests + settings)** downloads the test cases, descriptions and PDFs as a zip, plus an
`assignment.json` with the assignment's settings and its problems (scores, limits, languages, diff
settings). To run the same assignment again, for example next semester or on another SharIF Judge
installation:

1. Export it from the Assignments page.
2. **Add assignment** > **Import from export**, and pick the zip. The form is filled with the name,
   extra time, late rule, scoreboard and Java-exception switches, and every problem.
3. Set the **start and finish time**: they are left empty, because the old dates have passed.
   **Participants** is reset to `ALL` and **Open** and **Archived** are off, so students do not see
   the new assignment until you open it.
4. Check the form and save. The same zip is uploaded as the tests.

Python 2 is dropped from the languages when it is disabled in Settings. Import is only offered when
adding an assignment, never when editing, so problems that already have submissions are not
replaced. The export zip also works as a plain tests upload: `assignment.json` is ignored there, and
older zips without it still work as before.
