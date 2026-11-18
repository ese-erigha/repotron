from pathlib import Path

from evals.golden import load_golden


def test_when_the_golden_files_load_then_the_run_asks_thirty_questions() -> None:
    root = Path(__file__).resolve().parents[1]
    questions = load_golden(root / "golden")

    assert len(questions) == 30
