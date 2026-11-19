def needs_sigmoid(low: float, high: float) -> bool:
    return low < 0 or high > 1
