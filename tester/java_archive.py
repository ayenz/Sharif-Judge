#!/usr/bin/env python3
# Java archives for tester.sh: zips of Java source files and JAR files.
#
#   java_archive.py sources <zip> <dir>   extract the .java files into <dir>, write <dir>/../sources.txt
#                                         (one path per line, for javac @sources.txt) and print the
#                                         main class
#   java_archive.py jar <jar>             check the JAR and print its main class
#
# Problems are printed on stderr (shown to the student as the compile error) with exit code 1.
# Runs as the submission's user, inside its jail; it never writes outside <dir>.
import os
import re
import sys
import zipfile
from pathlib import PurePosixPath

MAX_FILES = 500
MAX_FILE_BYTES = 1024 * 1024
MAX_TOTAL_BYTES = 8 * 1024 * 1024
# Class file major version of the judge's Java (17). A newer one fails with
# UnsupportedClassVersionError at run time, which says little to a student.
MAX_CLASS_VERSION = 61
JAVA_VERSIONS = {52: 8, 53: 9, 54: 10, 55: 11, 56: 12, 57: 13, 58: 14, 59: 15, 60: 16, 61: 17, 62: 18, 63: 19,
                 64: 20, 65: 21, 66: 22, 67: 23, 68: 24, 69: 25}


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(1)


def open_zip(path, what):
    try:
        return zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError):
        fail(f"The file is not a valid {what}.")


def safe_name(name):
    """Relative path inside the archive, or None for names that could leave the folder."""
    p = PurePosixPath(name.replace("\\", "/"))
    if p.is_absolute() or not p.parts or any(part in ("", ".", "..") for part in p.parts):
        return None
    return p


# Folder and file names javac and the shell handle without quoting surprises.
SOURCE_PART = re.compile(r"^[\w\-.$ ]+$")


def strip_comments(text):
    return re.sub(r"/\*.*?\*/|//[^\n]*", " ", text, flags=re.S)


MAIN = re.compile(r"\bstatic\s+(?:final\s+)?(?:synchronized\s+)?void\s+main\s*\(\s*(?:final\s+)?String\s*(?:\[\s*\]\s*\w+|\.\.\.\s*\w+|\w+\s*\[\s*\])\s*\)")
PACKAGE = re.compile(r"^\s*package\s+([\w.]+)\s*;", re.M)


def sources(zip_path, out_dir):
    z = open_zip(zip_path, "zip file")
    files, total = [], 0
    for info in z.infolist():
        if info.is_dir() or not info.filename.endswith(".java"):
            continue
        p = safe_name(info.filename)
        if p is None:
            fail(f"Unsafe path in the zip file: {info.filename}")
        if p.parts[0] == "__MACOSX":
            continue
        if not all(SOURCE_PART.match(part) for part in p.parts):
            fail(f"Unsupported characters in a file name in the zip: {info.filename}")
        files.append((p, info))
        total += info.file_size
        if len(files) > MAX_FILES:
            fail(f"The zip file has more than {MAX_FILES} Java files.")
        if info.file_size > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
            fail("The Java files in the zip are too large.")
    if not files:
        fail("The zip file contains no .java files.")

    out = PurePosixPath(out_dir)
    candidates = []
    listed = []
    written = 0  # actual bytes: the sizes in a zip's headers can lie
    for p, info in files:
        with z.open(info) as src:
            data = src.read(MAX_FILE_BYTES + 1)
        written += len(data)
        if len(data) > MAX_FILE_BYTES or written > MAX_TOTAL_BYTES:
            fail("The Java files in the zip are too large.")
        target = out.joinpath(*p.parts)
        os.makedirs(target.parent, exist_ok=True)
        with open(target, "wb") as f:
            f.write(data)
        listed.append(str(target))
        code = strip_comments(data.decode("utf-8", "replace"))
        if MAIN.search(code):
            pkg = PACKAGE.search(code)
            candidates.append((pkg.group(1) + "." if pkg else "") + p.stem)
    with open(out.parent / "sources.txt", "w") as f:
        f.write("\n".join(f'"{name}"' for name in listed) + "\n")

    if not candidates:
        fail("No class has a main method (public static void main(String[] args)).")
    if len(candidates) > 1:
        named_main = [c for c in candidates if c.split(".")[-1] == "Main"]
        if len(named_main) != 1:
            fail("Several classes have a main method: " + ", ".join(sorted(candidates))
                 + ". Keep one, or name the class to run Main.")
        candidates = named_main
    print(candidates[0])


def manifest_main_class(text):
    # Manifest lines longer than 72 bytes continue on the next line, which starts with a space.
    text = re.sub(r"\r?\n ", "", text)
    for line in text.splitlines():
        if line.lower().startswith("main-class:"):
            return line.split(":", 1)[1].strip()
    return None


def jar(jar_path):
    z = open_zip(jar_path, "JAR file")
    total = 0
    classes = set()
    for info in z.infolist():
        if safe_name(info.filename) is None:
            fail(f"Unsafe path in the JAR file: {info.filename}")
        total += info.file_size
        if total > 4 * MAX_TOTAL_BYTES or len(classes) > 5000:
            fail("The JAR file is too large.")
        if info.filename.endswith(".class") and not info.filename.startswith("META-INF/"):
            classes.add(info.filename)
            with z.open(info) as f:
                head = f.read(8)  # only the header: a lying size cannot make this large
            if len(head) < 8 or head[:4] != b"\xca\xfe\xba\xbe":
                fail(f"{info.filename} is not a valid class file.")
            major = int.from_bytes(head[6:8], "big")
            if major > MAX_CLASS_VERSION:
                version = JAVA_VERSIONS.get(major, f"class version {major}")
                fail(f"{info.filename} was compiled for Java {version}, but the judge runs Java 17. "
                     "Compile with --release 17 (in an IDE: set the language level / target to 17).")
    if not classes:
        fail("The JAR file contains no classes.")
    try:
        with z.open("META-INF/MANIFEST.MF") as f:
            manifest = f.read(1024 * 1024).decode("utf-8", "replace")
    except KeyError:
        manifest = ""
    main = manifest_main_class(manifest)
    if not main:
        fail("The JAR file has no Main-Class in META-INF/MANIFEST.MF. Export it as a runnable JAR, "
             "or set the main class in the build.")
    if not re.fullmatch(r"[\w$]+(\.[\w$]+)*", main):
        fail(f"Invalid Main-Class in the manifest: {main}")
    if main.replace(".", "/") + ".class" not in classes:
        fail(f"The Main-Class {main} is not in the JAR file.")
    print(main)


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "sources":
        sources(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 3 and sys.argv[1] == "jar":
        jar(sys.argv[2])
    else:
        fail("usage: java_archive.py sources <zip> <dir> | jar <jar>")
