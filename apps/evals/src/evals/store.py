import json
import sys
import time
from pathlib import Path

from evals.summary import EvalSummary, build_summary

ROOT = Path(__file__).resolve().parents[2]


def summary_key(commit_sha: str) -> str:
    if commit_sha == "" or "/" in commit_sha or commit_sha in {".", ".."}:
        raise ValueError("The summary needs a commit.")
    return f"evals/{commit_sha}.json"


def summary_from_report(report: object, commit_sha: str, created_at: int) -> EvalSummary:
    return build_summary(report, commit_sha, created_at, _hit(report))


def write_summary(report: object, commit_sha: str, created_at: int, dest: Path) -> str:
    summary = summary_from_report(report, commit_sha, created_at)
    dest.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary_key(commit_sha)


def _hit(report: object) -> float:
    if not isinstance(report, dict):
        raise TypeError("The report is not an object.")
    value: object = report.get("identifierHitAt1")
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise TypeError("The report has no identifierHitAt1.")
    return float(value)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("The summary needs a commit.")
    report_path = ROOT / "report.json"
    parsed: object = json.loads(report_path.read_text(encoding="utf-8"))
    created_at = int(time.time() * 1000)
    print(write_summary(parsed, sys.argv[1], created_at, ROOT / "summary.json"))


if __name__ == "__main__":
    main()
