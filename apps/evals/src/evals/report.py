import math
from decimal import Decimal

DROP_LIMIT = Decimal("0.02")
INPUT_DOLLARS_PER_MILLION = Decimal("0.10")
OUTPUT_DOLLARS_PER_MILLION = Decimal("0.50")


def failing_scores(report: dict[str, float], baseline: dict[str, float]) -> list[str]:
    failed: list[str] = []
    for name, base in baseline.items():
        score = report.get(name)
        if score is None or Decimal(str(base)) - Decimal(str(score)) > DROP_LIMIT:
            failed.append(name)
    return failed


def percentile_95(values: list[int]) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(math.ceil(0.95 * len(ordered)) - 1, 0)
    return ordered[index]


def dollars(input_tokens: int, output_tokens: int) -> float:
    cost = input_tokens * INPUT_DOLLARS_PER_MILLION + output_tokens * OUTPUT_DOLLARS_PER_MILLION
    return float(cost / Decimal(1_000_000))
