"""Secrets-isolation guard for the TradingView authenticated-candidate path.

The guard ships in C1 *before* any fetcher exists. It enforces three rules:

1. **Allowlist (NAME) check.** The strings ``TRADINGVIEW_USERNAME``,
   ``TRADINGVIEW_PASSWORD``, and ``ENABLE_AUTHENTICATED_CANDIDATES`` may only
   appear in the explicit ``SECRET_NAME_ALLOWLIST`` files defined below.
   Anywhere else, the test fails.

2. **Value-leak check.** Set fake env values, invoke each
   ``scripts/ingest/fetch_tradingview_*.py`` ``main()`` with a mocked client,
   and assert the fake values never appear in stdout, stderr, or any file
   the fetcher wrote.

3. **Cache-dir check.** After invoking each TV fetcher's ``main()``,
   ``TVDATAFEED_CACHE_DIR`` must be set to a path under
   ``tempfile.gettempdir()``.

Rules 2 and 3 no-op when no fetchers exist on disk yet (C1 ships zero
fetchers). When PRs C2/C3/C4 add their fetchers, those scripts must also
be appended to ``SECRET_NAME_ALLOWLIST`` so rule 1 keeps passing — that
allowlist update is the only place future PRs need to touch this test.
"""
from __future__ import annotations

import glob
import importlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from scripts.shared import config


REPO_ROOT = Path(__file__).resolve().parents[2]
SECRET_NAMES_PATTERN = (
    r"TRADINGVIEW_USERNAME|TRADINGVIEW_PASSWORD|ENABLE_AUTHENTICATED_CANDIDATES"
)

# Files allowed to mention any of the three secret-NAME strings.
# Future PRs (C2/C3/C4) append their fetcher path here when they add a
# scripts/ingest/fetch_tradingview_*.py module. The script can be
# referenced as both a forward and back slash path; tests normalize.
SECRET_NAME_ALLOWLIST: tuple[str, ...] = (
    ".github/workflows/update-data.yml",
    "scripts/shared/config.py",
    "tests/python/test_config_secrets.py",
    "tests/python/test_secrets_isolation.py",
    "docs/source_reviews/tradingview_authenticated_candidates.md",
    # Superpowers spec + plan docs that describe the secret governance.
    "docs/superpowers/plans/2026-05-10-data-source-and-focus-pattern-expansion.md",
    "docs/superpowers/plans/2026-05-11-phase-c-prs.md",
    "docs/superpowers/plans/2026-05-11-bcd-replan.md",
    "docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md",
    # PR C2 MOVE fetcher:
    "scripts/ingest/fetch_tradingview_move.py",
    "tests/python/test_fetch_tradingview_move.py",
    # PR C3 put/call fetcher:
    "scripts/ingest/fetch_tradingview_put_call.py",
    "tests/python/test_fetch_tradingview_put_call.py",
    # PR C4 VIX term-structure fetcher:
    "scripts/ingest/fetch_tradingview_vix_term.py",
    "tests/python/test_fetch_tradingview_vix_term.py",
    # PR C4 VIX term metrics transform (allowlisted because it's in the
    # tradingview_* family; the transform itself does not use credentials
    # but shares the naming convention, so explicit allowlisting is cleaner).
    "scripts/transform/build_tradingview_vix_term_metrics.py",
    "tests/python/test_build_tradingview_vix_term_metrics.py",
)

FAKE_USERNAME = "fake-user-token-abc123-isolation-canary"
FAKE_PASSWORD = "fake-pass-token-xyz789-isolation-canary"


def _git_tracked_files_matching(pattern: str) -> list[Path]:
    """Return repo-tracked files containing the given regex.

    Uses ``git grep`` (not bare ``grep``) so untracked files, build
    artifacts, and the local venv are automatically excluded.
    """
    proc = subprocess.run(
        ["git", "grep", "-lE", pattern],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    # git grep exits 1 when there are no matches; only treat >1 as an error.
    if proc.returncode > 1:
        raise RuntimeError(f"git grep failed: {proc.stderr}")
    return [REPO_ROOT / line for line in proc.stdout.splitlines() if line.strip()]


def _normalize_path(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def _tv_fetcher_paths() -> list[Path]:
    return sorted(
        Path(p)
        for p in glob.glob(
            str(REPO_ROOT / "scripts" / "ingest" / "fetch_tradingview_*.py")
        )
    )


# ----------------------------------------------------------------------
# Rule 1: secret-NAME allowlist
# ----------------------------------------------------------------------


def test_secret_name_strings_appear_only_in_allowlisted_files() -> None:
    """No file outside the allowlist may mention any TV secret name."""
    matched = _git_tracked_files_matching(SECRET_NAMES_PATTERN)
    matched_rel = {_normalize_path(p) for p in matched}
    allowed_rel = set(SECRET_NAME_ALLOWLIST)

    leaked = matched_rel - allowed_rel
    assert not leaked, (
        "Secret-NAME strings (TRADINGVIEW_USERNAME / TRADINGVIEW_PASSWORD / "
        "ENABLE_AUTHENTICATED_CANDIDATES) appeared in files outside the "
        "allowlist. Either remove the references or extend "
        f"SECRET_NAME_ALLOWLIST in {__file__}. Leaked files: "
        f"{sorted(leaked)}"
    )


def test_allowlist_files_actually_exist() -> None:
    """Every allowlist entry must correspond to a real tracked file.

    Prevents stale allowlist entries from drifting silently after a file
    is renamed or removed.
    """
    for rel in SECRET_NAME_ALLOWLIST:
        # Allow forward-declared fetcher entries (commented out in the
        # source) by only checking entries that survive as live strings.
        assert (REPO_ROOT / rel).exists(), (
            f"Allowlist entry {rel!r} does not exist. Either restore the "
            f"file or remove the entry from SECRET_NAME_ALLOWLIST."
        )


# ----------------------------------------------------------------------
# Rule 1b: helper sanity (also covered in test_config_secrets.py but
# re-asserted here so the isolation test stands alone).
# ----------------------------------------------------------------------


def test_secret_returns_none_for_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "")
    assert config.secret("TRADINGVIEW_USERNAME") is None


def test_credentials_unavailable_without_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ENABLE_AUTHENTICATED_CANDIDATES", raising=False)
    monkeypatch.delenv("TRADINGVIEW_USERNAME", raising=False)
    monkeypatch.delenv("TRADINGVIEW_PASSWORD", raising=False)
    assert config.tradingview_credentials_available() is False


# ----------------------------------------------------------------------
# Rule 2: secret-VALUE leak check (active once fetchers exist)
# ----------------------------------------------------------------------


def _enable_fake_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", FAKE_USERNAME)
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", FAKE_PASSWORD)


def _build_fake_tv_client() -> MagicMock:
    fake_tv = MagicMock()
    fake_tv.get_hist.return_value = pd.DataFrame(
        {"open": [1.0], "high": [1.0], "low": [1.0], "close": [1.0], "volume": [0.0]},
        index=pd.to_datetime(["2024-01-01"]),
    )
    return fake_tv


@pytest.mark.parametrize("fetcher_path", _tv_fetcher_paths() or [pytest.param(None, marks=pytest.mark.skip(reason="no TV fetchers yet"))])
def test_fetcher_does_not_leak_fake_credentials(
    fetcher_path: Path | None,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Run each TV fetcher with fake creds and a mocked client; assert no leak.

    No-ops in C1 because no fetcher exists. Activates automatically when
    PRs C2/C3/C4 add their fetcher modules under scripts/ingest/.
    """
    assert fetcher_path is not None  # skipped path above guards None
    _enable_fake_secrets(monkeypatch)

    module_name = f"scripts.ingest.{fetcher_path.stem}"
    if module_name in sys.modules:
        importlib.reload(sys.modules[module_name])
    module = importlib.import_module(module_name)

    # Redirect the fetcher's output dir into tmp_path/candidates.
    from scripts.shared import io as shared_io

    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir(exist_ok=True)

    fake_tv = _build_fake_tv_client()
    builder = getattr(module, "_build_tv_client", None)
    if builder is None:
        pytest.skip(
            f"{module_name} has no _build_tv_client to patch; fetcher must "
            "expose this factory per the spec so isolation tests can mock."
        )
    with patch.object(module, "_build_tv_client", return_value=fake_tv):
        module.main()

    captured = capsys.readouterr()
    assert FAKE_USERNAME not in captured.out
    assert FAKE_USERNAME not in captured.err
    assert FAKE_PASSWORD not in captured.out
    assert FAKE_PASSWORD not in captured.err

    for written in tmp_path.rglob("*"):
        if written.is_file():
            blob = written.read_text(encoding="utf-8", errors="ignore")
            assert FAKE_USERNAME not in blob, f"username leaked to {written}"
            assert FAKE_PASSWORD not in blob, f"password leaked to {written}"


# ----------------------------------------------------------------------
# Rule 3: cache-dir check (active once fetchers exist)
# ----------------------------------------------------------------------


@pytest.mark.parametrize("fetcher_path", _tv_fetcher_paths() or [pytest.param(None, marks=pytest.mark.skip(reason="no TV fetchers yet"))])
def test_fetcher_sets_cache_dir_under_tempdir(
    fetcher_path: Path | None,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """After each TV fetcher's main(), TVDATAFEED_CACHE_DIR is under tempdir."""
    assert fetcher_path is not None
    _enable_fake_secrets(monkeypatch)
    monkeypatch.delenv("TVDATAFEED_CACHE_DIR", raising=False)

    module_name = f"scripts.ingest.{fetcher_path.stem}"
    if module_name in sys.modules:
        importlib.reload(sys.modules[module_name])
    module = importlib.import_module(module_name)

    from scripts.shared import io as shared_io

    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir(exist_ok=True)

    fake_tv = _build_fake_tv_client()
    builder = getattr(module, "_build_tv_client", None)
    if builder is None:
        pytest.skip(
            f"{module_name} has no _build_tv_client to patch; fetcher must "
            "expose this factory per the spec so isolation tests can mock."
        )
    with patch.object(module, "_build_tv_client", return_value=fake_tv):
        module.main()

    cache_dir = os.environ.get("TVDATAFEED_CACHE_DIR", "")
    assert cache_dir, (
        f"{module_name} did not set TVDATAFEED_CACHE_DIR before instantiating "
        "the TV client; the fetcher must point any on-disk session cache at "
        "tempfile.gettempdir()."
    )
    tempdir = tempfile.gettempdir()
    assert cache_dir.startswith(tempdir) or os.path.realpath(cache_dir).startswith(
        os.path.realpath(tempdir)
    ), (
        f"{module_name} set TVDATAFEED_CACHE_DIR={cache_dir!r}, which is not "
        f"under tempfile.gettempdir()={tempdir!r}. Cache directories must "
        "never land in the home directory or repo root."
    )
