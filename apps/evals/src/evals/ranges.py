from dataclasses import dataclass


@dataclass(frozen=True)
class LineRange:
    path: str
    start_line: int
    end_line: int


def ranges_overlap(left: LineRange, right: LineRange) -> bool:
    return (
        left.path == right.path
        and left.start_line <= right.end_line
        and right.start_line <= left.end_line
    )
