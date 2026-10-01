"""The budget: CREDITS.md total + uncredited ledger rows, the hard cap, and folding into CREDITS.md."""
import pytest

import ledger

CREDITS = """# Credits

## Images

| File | Cost (USD) |
| ---- | ---------- |
| a.png | 1.0000 |

## Budget

Shared cap: **$10.00**

| Item | Cost (USD) |
| ---- | ---------- |
| Images (1 generation) | 1.0000 |
| Music (2 generations) | 0.5000 |
| **Running total** | **1.5000 of 10.00** (8.5000 remaining) |
"""


@pytest.fixture
def files(tmp_path):
    c, l = tmp_path / "CREDITS.md", tmp_path / "ledger.tsv"
    c.write_text(CREDITS)
    return str(c), str(l)


def test_reads_the_running_total_and_cap(files):
    c, _ = files
    assert ledger.credits_total(c) == (1.5, 10.0)


def test_the_real_credits_file_parses():
    total, cap = ledger.credits_total()
    assert cap == 10.0 and 0 < total < cap


def test_pending_rows_count_until_credited(files):
    c, l = files
    ledger.record("art", "x", "m", 0.25, "x.png", ledger=l)
    s = ledger.status(c, l)
    assert s["spent"] == pytest.approx(1.75) and s["remaining"] == pytest.approx(8.25)


def test_refuses_a_call_that_would_pass_the_cap(files):
    c, l = files
    ledger.record("art", "big", "m", 8.40, "big.png", ledger=l)       # spent 9.90
    ledger.check(0.10, c, l)                                          # exactly at the cap: allowed
    with pytest.raises(ledger.BudgetError, match="budget cap"):
        ledger.check(0.11, c, l)


def test_credit_folds_rows_into_credits_and_recomputes_the_total(files):
    c, l = files
    ledger.record("art", "enemy_v1", "google/gemini-3.1-flash-image", 0.1027, "enemy_v1.png", "first try", ledger=l)
    ledger.record("art", "enemy_v2", "google/gemini-3.1-flash-image", 0.1021, "enemy_v2.png", ledger=l)
    total = ledger.credit(c, l, fmt=False)
    assert total == pytest.approx(1.7048)
    text = open(c).read()
    assert "| Art pipeline (2 generations) | 0.2048 |" in text
    assert "**1.7048 of 10.00** (8.2952 remaining)" in text
    assert "`enemy_v1`" in text and "first try" in text
    assert "| a.png | 1.0000 |" in text                              # existing line items kept
    s = ledger.status(c, l)
    assert s["pending"] == 0 and s["spent"] == pytest.approx(1.7048)  # never counted twice
    ledger.record("art", "enemy_v3", "m", 0.1, "enemy_v3.png", ledger=l)
    assert ledger.credit(c, l, fmt=False) == pytest.approx(1.8048)
    assert open(c).read().count("Art pipeline (") == 1


def test_estimates_cover_the_measured_flash_cost():
    assert ledger.estimate("google/gemini-3.1-flash-image", "2K") >= 0.1027
    assert ledger.estimate("unknown/model") == ledger.DEFAULT_ESTIMATE
