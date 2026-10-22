# Cheat detection

SharIF Judge looks for submissions that are suspiciously similar, and combines that with how the
code was written in the built-in editor. The result is a list of students and pairs to review.
It is a starting point for an instructor's judgement, never a verdict on its own.

Open it from **Cheat Detection** in the sidebar (head instructors and admins), or from the menu of
an assignment on the Assignments page.

## How it works

1. **Collect.** For every problem of the assignment, the final submission of each student is taken
   and grouped by language (C, C++, Java, Python, JavaScript, Go). Upload-only files (zip, pdf, txt)
   are skipped.
2. **Compare.** [JPlag](https://github.com/jplag/JPlag) 6.3 compares every pair within a group. It
   parses the code into tokens (keywords, operators, structure) instead of comparing text, so
   renaming variables, changing comments or reformatting does not hide a copy. Neighbouring
   matches are merged, and for Java and C++ the code is normalized first, to resist common tricks.
3. **Store.** Every pair with a meaningful similarity is saved with the matching line ranges.
   JPlag runs on the server: no code is sent anywhere.
4. **Score.** Each student gets a review score that adds up similarity and editor signals (below).

Runs are queued and processed in the background, one at a time. Each (problem, language) keeps its
latest run; running the analysis again replaces it.

## Running an analysis

Click **Run analysis** and choose:

- **Problems**: by default every problem that has code submissions.
- **Compare with other assignments**: also compare against the final submissions of other
  assignments, for example last year's run of the same course. Only the current assignment's
  students are scored; similarity with a student's *own* older work is ignored.
- **Sensitivity**: the minimum length of a matching section, in tokens.
  - *Default* lets JPlag decide and adapts to short programs (see below).
  - *High* (6 tokens) finds smaller copied pieces but flags more harmless similarity.
  - *Low* (20 tokens) only reports long copied sections.

### Template code

If students start from code you gave them, add it on the **Template code** tab (per problem and
language). Matches inside the template are ignored by JPlag and also sent to Moss. A template that
is shorter than the minimum match length is ignored with a warning on the run.

### Short programs

Introductory exercises are often only 20–30 tokens long. With JPlag's default minimum match of
12 tokens, a copy whose functions were reordered can drop to about 50% similarity. When no
sensitivity is chosen, SharIF Judge measures the median program length after a first pass and,
for short programs, runs again with a minimum match of `median ÷ 6` tokens (never below 4). The run
card then says that sensitivity was raised automatically. In our tests this raised a reordered
copy from 52% to 88% while an independent solution stayed at 0%; a minimum of 3 tokens already
flagged the independent solution, which is why 4 is the floor.

Pairs that only share scattered fragments (longest common section under 6 tokens and similarity
under 60%) are not stored.

## Reading the results

### Students tab

One row per final submission, sorted by review score:

| Level | Score | Meaning |
|---|---|---|
| Needs review | 55–100 | Strong indicators: look at the code and the recording |
| Check | 25–54 | Something stands out: worth a quick look |
| OK | 0–24 | Nothing notable |

The score is the sum of these rules (capped at 100). Each one that applies is listed as a reason.

| Signal | Points |
|---|---|
| Code similarity ≥ 90% with someone | 55 |
| Code similarity 70–89% | 40 |
| Code similarity 50–69% | 20 |
| One insertion (paste) of ≥ 200 characters that is ≥ 50% of the final code | 30 |
| Otherwise, one insertion of ≥ 100 characters | 15 |
| Left the page ≥ 15 times while coding | 15 |
| Left the page 8–14 times | 8 |
| ≥ 400 characters written in under 2 minutes of editor time | 10 |

Editor signals exist only for code submitted through the built-in editor. Uploaded files show
**No editor recording**.

Similarity is symmetric: when A and B are similar, both are flagged, because the code alone cannot
show who copied from whom. The editor signals usually can (the copy tends to arrive as one large
paste), and the recording replay shows exactly how the code was written.

### Similar pairs tab

All stored pairs, most similar first, with a filter on the minimum similarity. *Similarity* is the
share of both programs covered by matching sections; *longest match* is the longest single section
in tokens. Pairs with an older submission are marked with the assignment they come from.

Click a pair to open the **side-by-side comparison**: matching sections have the same color on both
sides, and the match list scrolls both programs to a section.

### Run cards

Each card shows the status of a (problem, language) run, how many submissions were compared, notes
(template ignored, sensitivity raised) and submissions that were **not compared**, usually because
they are too short or JPlag could not parse them (for example Python 2 syntax). The download button
gives the raw JPlag report, which can be opened in the official
[JPlag report viewer](https://jplag.github.io/JPlag/).

## History across assignments

**History** (button on the cheat detection page, or `/cheat/history`) combines the latest analysis of
every assignment:

- **Repeated pairs**: two students who are similar (70%+ by default; 50% and 90% can be chosen) in
  two or more assignments. Copying that happens again and again is the strongest signal.
- **Students**: for each student, in how many assignments they were similar to someone, their highest
  similarity, and with whom (`bob ×3` means similar to bob in three assignments). Expand a row to
  open each pair.

## Moss

The **Moss (legacy)** tab keeps the previous integration with Stanford's
[Moss](https://theory.stanford.edu/~aiken/moss/) service. It needs a Moss user id (register by
email with Moss), sends the code to Stanford's server, and returns a link that expires after about
14 days. The Nuxt version fixes a legacy bug: the language is now sent to Moss (`-l`); before, every
file was parsed as C. Each language is a separate request, and template code is sent with `-b`.
Moss has no Go grammar, so Go submissions are only compared by the local JPlag engine.

## Limits

- Similar code is not proof. Short or standard exercises have few reasonable solutions, and
  students who studied together write alike. Always look at the code and the recording.
- Only final submissions are compared.
- Python 2 code may fail to parse with the Python 3 grammar and is then listed as not compared.
- An analysis of a large class with many older assignments can take minutes; it runs in the
  background, so the page can be closed meanwhile.

## For administrators

- The Docker image contains a Java 25 runtime (`/opt/jre25`) and JPlag (`/opt/jplag/jplag.jar`),
  both downloaded with pinned SHA-256 checksums. The judge itself stays on Java 17.
- Work files go to `NUXT_CHEAT_WORK_DIR` (`/data/cheat` in the image) and are deleted after each
  run; only the `.jplag` report of the latest run per problem and language is kept.
- Results are stored in the `shj_cheat_runs` and `shj_cheat_pairs` tables, created automatically
  on startup.
- Without `NUXT_CHEAT_JPLAG_JAR` the page shows that the engine is unavailable; Moss still works.
