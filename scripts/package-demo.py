"""Create a reviewable source archive without local credentials or build output."""

from pathlib import Path
from sys import argv
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {
    ".git", ".next", ".vercel", "node_modules", "test-results",
    "playwright-report", "coverage", "dist", "out", ".temp", ".branches",
}
EXCLUDED_FILES = {".env", ".env.local", "demo-credentials.local.json"}


def included_files(directory: Path):
    for child in sorted(directory.iterdir()):
        if child.is_dir():
            if child.name not in EXCLUDED_DIRS:
                yield from included_files(child)
        elif child.is_file():
            name = child.name
            if name in EXCLUDED_FILES or (name.startswith(".env.") and name != ".env.example"):
                continue
            if name.endswith((".log", ".tsbuildinfo", ".pyc")):
                continue
            yield child


if len(argv) != 2:
    raise SystemExit("Usage: python scripts/package-demo.py ABSOLUTE_OUTPUT_ZIP")
destination = Path(argv[1]).resolve()
if destination.suffix.lower() != ".zip" or destination.is_relative_to(ROOT):
    raise SystemExit("The destination must be a .zip outside the project directory.")
destination.parent.mkdir(parents=True, exist_ok=True)
files = list(included_files(ROOT))
with ZipFile(destination, mode="x", compression=ZIP_DEFLATED, compresslevel=6) as archive:
    for file in files:
        archive.write(file, f"{ROOT.name}/{file.relative_to(ROOT).as_posix()}")
print(f"Archived {len(files)} source files to {destination}")
