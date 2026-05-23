#!/usr/bin/env python3
"""Build Bizzlo's partner university index from exported commission PDFs.

The generated index intentionally excludes commission rates, fixed payouts,
gross/net basis, and rate-applied-on fields. It keeps only destination,
university, intake/year, study-level coverage, and source metadata so the app
can use the exports as a partner-university/course-finder baseline.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover - developer setup guard
    raise SystemExit("Install pypdf to import partner university PDFs: python3 -m pip install pypdf") from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF_DIR = Path.home() / "Downloads"
UNIVERSITY_JSON = ROOT / "public" / "data" / "partner-university-index.json"
COURSE_TEMPLATE_JSON = ROOT / "private-data" / "partner-course-templates.json"
SEPTEMBER_2026_INTAKE = "September 2026"

COUNTRY_ALIASES = {
    "United States of America": "United States",
    "United Arab Emirates": "Dubai",
}

SKIPPED_COUNTRIES = {"Search and Selection (Non-Tie-up)"}

HEADER_LINE = re.compile(
    r"^([A-Za-z ]+ Overseas|For |Commission Structure|Sr\.|No\.|University Name|Study Level|Associate|Gross|Net|Fixed|Rate|Applied on|Payment Terms|AoA|CoA|\*AoA)",
    re.IGNORECASE,
)

STUDY_LEVEL_PATTERNS = [
    ("Undergraduate", re.compile(r"\b(Undergraduate|Bachelor|UG)\b", re.IGNORECASE)),
    ("Postgraduate", re.compile(r"\b(Postgraduate|Masters?|PGT|PGR|MBA)\b", re.IGNORECASE)),
    ("PhD", re.compile(r"\b(PhD|Doctoral|Doctorate)\b", re.IGNORECASE)),
    ("Pathway", re.compile(r"\b(Pathway|Foundation|International Year|Pre[-\s]?Master)\b", re.IGNORECASE)),
    ("English Language", re.compile(r"\b(English Language|Pre[-\s]?sessional|ESL|ELP|IEP)\b", re.IGNORECASE)),
]

UG_TEMPLATES = [
    ("Business", "Undergraduate", "Bachelor of Business", "Bachelor", "3-4 years"),
    ("Business", "Undergraduate", "Bachelor of Business Administration", "Bachelor", "3-4 years"),
    ("Business", "Undergraduate", "Bachelor of Commerce", "Bachelor", "3-4 years"),
    ("Management", "Undergraduate", "BA Business Management", "BA", "3-4 years"),
    ("Accounting and Finance", "Undergraduate", "BSc Accounting and Finance", "BSc", "3-4 years"),
    ("Economics", "Undergraduate", "BSc Economics", "BSc", "3-4 years"),
    ("Marketing", "Undergraduate", "BSc Marketing", "BSc", "3-4 years"),
    ("International Business", "Undergraduate", "BSc International Business", "BSc", "3-4 years"),
    ("Computer Science", "Undergraduate", "BSc Computer Science", "BSc", "3-4 years"),
    ("Software Engineering", "Undergraduate", "BSc Software Engineering", "BSc", "3-4 years"),
    ("Information Technology", "Undergraduate", "Bachelor of Information Technology", "Bachelor", "3-4 years"),
    ("Cyber Security", "Undergraduate", "BSc Cyber Security", "BSc", "3-4 years"),
    ("Artificial Intelligence", "Undergraduate", "BSc Artificial Intelligence", "BSc", "3-4 years"),
    ("Data Science", "Undergraduate", "BSc Data Science", "BSc", "3-4 years"),
    ("Engineering", "Undergraduate", "BEng Mechanical Engineering", "BEng", "3-4 years"),
    ("Engineering", "Undergraduate", "BEng Civil Engineering", "BEng", "3-4 years"),
    ("Engineering", "Undergraduate", "BEng Electrical and Electronic Engineering", "BEng", "3-4 years"),
    ("Engineering", "Undergraduate", "BEng Computer Engineering", "BEng", "3-4 years"),
    ("Health", "Undergraduate", "Bachelor of Nursing", "Bachelor", "3-4 years"),
    ("Health", "Undergraduate", "Bachelor of Public Health", "Bachelor", "3-4 years"),
    ("Biomedical Science", "Undergraduate", "BSc Biomedical Science", "BSc", "3-4 years"),
    ("Psychology", "Undergraduate", "BSc Psychology", "BSc", "3-4 years"),
    ("Science", "Undergraduate", "BSc Biotechnology", "BSc", "3-4 years"),
    ("Environmental Science", "Undergraduate", "BSc Environmental Science", "BSc", "3-4 years"),
    ("Law", "Undergraduate", "LLB Law", "LLB", "3-4 years"),
    ("International Relations", "Undergraduate", "BA International Relations", "BA", "3-4 years"),
    ("Media", "Undergraduate", "BA Media and Communications", "BA", "3-4 years"),
    ("Hospitality", "Undergraduate", "BA Tourism and Hospitality Management", "BA", "3-4 years"),
    ("Architecture", "Undergraduate", "Bachelor of Architecture", "Bachelor", "3-5 years"),
    ("Education", "Undergraduate", "BA Education Studies", "BA", "3-4 years"),
]

PG_TEMPLATES = [
    ("Business", "Postgraduate", "Master of Business Administration", "MBA", "1-2 years"),
    ("Management", "Postgraduate", "MSc Management", "MSc", "1-2 years"),
    ("International Business", "Postgraduate", "MSc International Business", "MSc", "1-2 years"),
    ("Marketing", "Postgraduate", "MSc Marketing", "MSc", "1-2 years"),
    ("Finance", "Postgraduate", "MSc Finance", "MSc", "1-2 years"),
    ("Accounting and Finance", "Postgraduate", "MSc Accounting and Finance", "MSc", "1-2 years"),
    ("Business Analytics", "Postgraduate", "MSc Business Analytics", "MSc", "1-2 years"),
    ("Supply Chain", "Postgraduate", "MSc Supply Chain Management", "MSc", "1-2 years"),
    ("Project Management", "Postgraduate", "MSc Project Management", "MSc", "1-2 years"),
    ("Human Resource Management", "Postgraduate", "MSc Human Resource Management", "MSc", "1-2 years"),
    ("Data Science", "Postgraduate", "MSc Data Science", "MSc", "1-2 years"),
    ("Computer Science", "Postgraduate", "MSc Computer Science", "MSc", "1-2 years"),
    ("Artificial Intelligence", "Postgraduate", "MSc Artificial Intelligence", "MSc", "1-2 years"),
    ("Cyber Security", "Postgraduate", "MSc Cyber Security", "MSc", "1-2 years"),
    ("Software Engineering", "Postgraduate", "MSc Software Engineering", "MSc", "1-2 years"),
    ("Information Systems", "Postgraduate", "MSc Information Systems", "MSc", "1-2 years"),
    ("Engineering Management", "Postgraduate", "MSc Engineering Management", "MSc", "1-2 years"),
    ("Engineering", "Postgraduate", "MSc Mechanical Engineering", "MSc", "1-2 years"),
    ("Engineering", "Postgraduate", "MSc Civil Engineering", "MSc", "1-2 years"),
    ("Engineering", "Postgraduate", "MSc Electrical Engineering", "MSc", "1-2 years"),
    ("Renewable Energy", "Postgraduate", "MSc Renewable Energy Engineering", "MSc", "1-2 years"),
    ("Health", "Postgraduate", "Master of Public Health", "Master", "1-2 years"),
    ("Health", "Postgraduate", "MSc Nursing", "MSc", "1-2 years"),
    ("Biomedical Science", "Postgraduate", "MSc Biomedical Science", "MSc", "1-2 years"),
    ("Psychology", "Postgraduate", "MSc Psychology", "MSc", "1-2 years"),
    ("Biotechnology", "Postgraduate", "MSc Biotechnology", "MSc", "1-2 years"),
    ("Environmental Management", "Postgraduate", "MSc Environmental Management", "MSc", "1-2 years"),
    ("Law", "Postgraduate", "LLM International Business Law", "LLM", "1-2 years"),
    ("International Relations", "Postgraduate", "MA International Relations", "MA", "1-2 years"),
    ("Education", "Postgraduate", "MA Education", "MA", "1-2 years"),
    ("Media", "Postgraduate", "MA Digital Media", "MA", "1-2 years"),
    ("Hospitality", "Postgraduate", "MSc Hospitality and Tourism Management", "MSc", "1-2 years"),
    ("Architecture", "Postgraduate", "Master of Architecture", "Master", "1-2 years"),
    ("Construction", "Postgraduate", "MSc Construction Project Management", "MSc", "1-2 years"),
]

PATHWAY_TEMPLATES = [
    ("Pathway", "Undergraduate", "International Foundation Programme", "Foundation", "1 year"),
    ("Pathway", "Undergraduate", "International Year One", "Pathway", "1 year"),
    ("Pathway", "Postgraduate", "Pre-Masters Programme", "Pre-Masters", "6-12 months"),
]


def slug(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def parse_filename(path: Path) -> tuple[str, str, str] | None:
    stem = re.sub(r" \(\d+\)$", "", path.stem)
    match = re.match(r"Commission_Structure_(.+)_([A-Za-z]+)_([0-9]{4})$", stem)
    if not match:
        return None
    return match.group(1), match.group(2), match.group(3)


def dedupe_files(pdf_dir: Path) -> list[tuple[Path, str, str, str]]:
    files: dict[tuple[str, str, str], Path] = {}
    for path in pdf_dir.glob("Commission_Structure_*.pdf"):
        parsed = parse_filename(path)
        if not parsed:
            continue
        country, intake, year = parsed
        if country in SKIPPED_COUNTRIES:
            continue
        key = (country, intake, year)
        if key not in files or path.stat().st_mtime > files[key].stat().st_mtime:
            files[key] = path

    return [(path, *key) for key, path in sorted(files.items(), key=lambda item: item[0])]


def clean_university_name(lines: list[str]) -> str:
    kept: list[str] = []
    for line in lines:
        value = clean_line(line)
        if not value or HEADER_LINE.search(value):
            continue
        if value.startswith("Last Updated on"):
            continue
        kept.append(value)

    name = clean_line(" ".join(kept))
    name = re.sub(r"^[0-9]{1,4}\s+", "", name)
    name = name.replace(" ,", ",").strip(" -")
    return name


def updated_date(lines: list[str], index: int) -> str:
    joined = clean_line(" ".join(lines[index : index + 3]))
    match = re.search(r"Last Updated on\s+(\d{2}-\d{2}-\s*20\d{2})", joined, re.IGNORECASE)
    if not match:
        return ""
    return match.group(1).replace(" ", "")


def study_levels(block: str) -> list[str]:
    found = [label for label, pattern in STUDY_LEVEL_PATTERNS if pattern.search(block)]
    return found or ["All study levels"]


def extract_entries(path: Path, country: str, intake: str, year: str) -> list[dict[str, object]]:
    reader = PdfReader(str(path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    lines = [clean_line(line) for line in text.splitlines()]

    raw_entries: list[dict[str, object]] = []
    for index, line in enumerate(lines):
        if not line.startswith("Last Updated on"):
            continue

        start = None
        for previous in range(max(0, index - 10), index):
            if re.match(r"^\d{1,4}\s+\S", lines[previous]):
                start = previous

        if start is None:
            continue

        row_number = int(lines[start].split()[0])
        name_lines = [re.sub(r"^\d{1,4}\s+", "", lines[start]), *lines[start + 1 : index]]
        university = clean_university_name(name_lines)
        if len(university) < 2:
            continue

        raw_entries.append(
            {
                "rowNumber": row_number,
                "university": university,
                "updatedAt": updated_date(lines, index),
                "startLine": start,
                "updatedLine": index,
            }
        )

    entries: list[dict[str, object]] = []
    seen: set[tuple[int, str]] = set()
    for position, entry in enumerate(raw_entries):
        key = (int(entry["rowNumber"]), str(entry["university"]).lower())
        if key in seen:
            continue
        seen.add(key)

        next_start = int(raw_entries[position + 1]["startLine"]) if position + 1 < len(raw_entries) else min(len(lines), int(entry["updatedLine"]) + 80)
        block = "\n".join(lines[int(entry["updatedLine"]) : next_start])
        canonical_country = COUNTRY_ALIASES.get(country, country)
        levels = study_levels(block)
        has_restrictions = bool(re.search(r"\b(exclud|restrict|not eligible|not payable|no commission|withdraw)\b", block, re.IGNORECASE))
        rule_id = slug(f"{canonical_country}-{entry['university']}-{intake}-{year}")

        entries.append(
            {
                "id": rule_id,
                "rowNumber": entry["rowNumber"],
                "country": canonical_country,
                "sourceCountry": country,
                "intake": intake,
                "year": year,
                "university": entry["university"],
                "studyLevels": levels,
                "studyLevel": ", ".join(levels),
                "eligibilityStatus": "Partner listed",
                "hasRestrictions": has_restrictions,
                "updatedAt": entry["updatedAt"],
                "sourceFile": path.name,
            }
        )

    return entries


def course_templates_for(row: dict[str, object]) -> list[dict[str, object]]:
    levels = set(row.get("studyLevels") or [])
    include_ug = "Undergraduate" in levels or "All study levels" in levels or not levels
    include_pg = "Postgraduate" in levels or "All study levels" in levels or not levels
    include_pathway = "Pathway" in levels or "English Language" in levels
    templates = []
    if include_ug:
        templates.extend(UG_TEMPLATES)
    if include_pg:
        templates.extend(PG_TEMPLATES)
    if include_pathway:
        templates.extend(PATHWAY_TEMPLATES)

    courses = []
    for subject, level, course, credential, duration in templates:
        template_id = slug(f"partner-template-{row['id']}-{level}-{course}")
        courses.append(
            {
                "id": template_id,
                "catalog_key": template_id,
                "external_course_id": "",
                "source_name": "Partner September 2026 catalogue",
                "country": row["country"],
                "city": "",
                "campus": "",
                "university": row["university"],
                "level": level,
                "subject": subject,
                "course": course,
                "credential": credential,
                "duration": duration,
                "mode": "On campus",
                "intake": SEPTEMBER_2026_INTAKE,
                "partner_note": "Partner university; no commercial values included",
                "eligibility": "Verify exact course title, intake, tuition, and entry requirements before submission.",
                "source_updated_at": row.get("updatedAt") or date.today().isoformat(),
                "is_verified": False,
                "partner_university_id": row["id"],
                "partner_source_intake": f"{row['intake']} {row['year']}",
            }
        )
    return courses


def write_outputs(rows: list[dict[str, object]]) -> None:
    for path in (UNIVERSITY_JSON, COURSE_TEMPLATE_JSON):
        path.parent.mkdir(parents=True, exist_ok=True)

    course_rows: list[dict[str, object]] = []
    for row in rows:
        course_rows.extend(course_templates_for(row))

    UNIVERSITY_JSON.write_text(json.dumps(rows, separators=(",", ":"), ensure_ascii=True) + "\n", encoding="utf-8")
    COURSE_TEMPLATE_JSON.write_text(json.dumps(course_rows, separators=(",", ":"), ensure_ascii=True) + "\n", encoding="utf-8")

    countries = sorted({str(row["country"]) for row in rows})
    print(f"Imported {len(rows)} partner universities across {len(countries)} countries.")
    print(f"Generated {len(course_rows)} September 2026 UG/PG partner catalogue rows with no commission values.")
    print(f"Wrote {UNIVERSITY_JSON.relative_to(ROOT)}")
    print(f"Wrote {COURSE_TEMPLATE_JSON.relative_to(ROOT)}")


def main() -> None:
    pdf_dir = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_PDF_DIR
    if not pdf_dir.exists():
        raise SystemExit(f"PDF directory does not exist: {pdf_dir}")

    rows: list[dict[str, object]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for path, country, intake, year in dedupe_files(pdf_dir):
        for row in extract_entries(path, country, intake, year):
            key = (str(row["country"]).lower(), str(row["university"]).lower(), str(row["intake"]).lower(), str(row["year"]))
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)

    rows.sort(key=lambda item: (str(item["country"]), str(item["university"]), str(item["year"]), str(item["intake"])))
    write_outputs(rows)


if __name__ == "__main__":
    main()
