"""
Bye-round weighting helpers for trade calculations.

Acts as an optional layer on top of existing trade logic without replacing
the underlying selection rules. The database is expected to provide a
`bye_round_grade` integer (1-4) on each player record.
"""

from typing import Dict, List, Literal, Optional


Mode = Literal["trade_out", "trade_in"]


def _safe_grade(value: Optional[int]) -> int:
    """
    Normalise bye grade to an int. Unknown grades are pushed to the least
    favourable position for sorting.
    """
    try:
        grade = int(value)
    except (TypeError, ValueError):
        return 0  # unknown -> treated as least favourable for trade-in, most for trade-out
    return grade


def _value_score(candidate: Dict, strategy: str) -> float:
    """
    Extract the value score based on the selected strategy.
    - Strategy '2' uses projection (base)
    - All other strategies default to diff/value
    """
    if strategy == "2":
        return float(candidate.get("projection") or candidate.get("Projection") or 0)
    return float(candidate.get("diff") or candidate.get("Diff") or 0)


def apply_bye_weighting(
    candidates: List[Dict],
    *,
    mode: Mode,
    strategy: str,
) -> List[Dict]:
    """
    Apply bye-round weighting to candidate lists.

    For trade_out:
        Sorting key (highest priority first):
        (is_injured DESC, non_playing DESC, bye_round_grade ASC, value_score ASC)

    For trade_in:
        - Excludes candidates flagged as injured or non_playing
        Sorting key:
        (bye_round_grade DESC, value_score DESC)

    Returns a reordered list without mutating the input list.
    """
    weighted: List[Dict] = []
    for candidate in candidates:
        is_injured = bool(candidate.get("is_injured"))
        non_playing = bool(candidate.get("non_playing"))
        grade = _safe_grade(candidate.get("bye_round_grade"))
        value = _value_score(candidate, strategy)

        payload = dict(candidate)
        payload["_bye_sort"] = {
            "is_injured": is_injured,
            "non_playing": non_playing,
            "grade": grade,
            "value": value,
        }
        weighted.append(payload)

    if mode == "trade_out":
        weighted.sort(
            key=lambda c: (
                not c["_bye_sort"]["is_injured"],  # injured first (False sorts before True)
                not c["_bye_sort"]["non_playing"],  # non_playing next
                c["_bye_sort"]["grade"] if c["_bye_sort"]["grade"] > 0 else 5,
                c["_bye_sort"]["value"],
            )
        )
    else:  # trade_in
        filtered = [
            c for c in weighted if not c["_bye_sort"]["is_injured"] and not c["_bye_sort"]["non_playing"]
        ]
        print(f"Filtered out {len(weighted) - len(filtered)} injured/non-playing candidates, {len(filtered)} remaining")
        weighted = filtered
        weighted.sort(
            key=lambda c: (
                -(c["_bye_sort"]["grade"] or 0),
                -(c["_bye_sort"]["value"]),
            )
        )
        print(f"After bye weighting sort, top 5: {[c.get('name') or c.get('Player', 'NO_NAME') for c in weighted[:5]]}")

    # Drop helper sort payload before returning
    return [ {k: v for k, v in c.items() if k != "_bye_sort"} for c in weighted ]
