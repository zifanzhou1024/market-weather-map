"""Tests for ``scripts.shared.config`` secret helpers.

These tests exercise the helpers across enabled/disabled combinations and
assert that ``secret()`` strips whitespace, treats empty strings as missing,
and never returns the raw value when it is whitespace-only.
"""
from __future__ import annotations

import pytest

from scripts.shared import config


SECRET_NAMES = (
    "ENABLE_AUTHENTICATED_CANDIDATES",
    "TRADINGVIEW_USERNAME",
    "TRADINGVIEW_PASSWORD",
)


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each test starts with the relevant env vars unset."""
    for name in SECRET_NAMES:
        monkeypatch.delenv(name, raising=False)


def test_secret_returns_none_when_unset() -> None:
    assert config.secret("TRADINGVIEW_USERNAME") is None


def test_secret_returns_none_when_empty_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "")
    assert config.secret("TRADINGVIEW_USERNAME") is None


def test_secret_returns_none_when_whitespace_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "   \t\n")
    assert config.secret("TRADINGVIEW_USERNAME") is None


def test_secret_strips_surrounding_whitespace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "  fake-user-token  ")
    assert config.secret("TRADINGVIEW_USERNAME") == "fake-user-token"


def test_secret_returns_value_unchanged_when_already_clean(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user-token")
    assert config.secret("TRADINGVIEW_USERNAME") == "fake-user-token"


def test_authenticated_candidates_disabled_when_unset() -> None:
    assert config.authenticated_candidates_enabled() is False


@pytest.mark.parametrize("falsey", ["", "false", "False", "0", "no", "off", "FALSE"])
def test_authenticated_candidates_disabled_for_non_true_values(
    monkeypatch: pytest.MonkeyPatch, falsey: str
) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", falsey)
    assert config.authenticated_candidates_enabled() is False


@pytest.mark.parametrize("truthy", ["true", "True", "TRUE", "tRuE"])
def test_authenticated_candidates_enabled_for_true_values(
    monkeypatch: pytest.MonkeyPatch, truthy: str
) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", truthy)
    assert config.authenticated_candidates_enabled() is True


def test_tradingview_credentials_unavailable_when_nothing_set() -> None:
    assert config.tradingview_credentials_available() is False


def test_tradingview_credentials_unavailable_without_enable_flag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "fake-pass")
    assert config.tradingview_credentials_available() is False


def test_tradingview_credentials_unavailable_without_username(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "fake-pass")
    assert config.tradingview_credentials_available() is False


def test_tradingview_credentials_unavailable_without_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user")
    assert config.tradingview_credentials_available() is False


def test_tradingview_credentials_unavailable_when_username_blank(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "   ")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "fake-pass")
    assert config.tradingview_credentials_available() is False


def test_tradingview_credentials_unavailable_when_password_blank(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "")
    assert config.tradingview_credentials_available() is False


def test_tradingview_credentials_available_when_all_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "fake-pass")
    assert config.tradingview_credentials_available() is True


def test_helpers_do_not_print_values(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Calling the helpers must never write the secret value to stdout/stderr."""
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user-token-abc123")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "fake-pass-token-xyz789")

    config.secret("TRADINGVIEW_USERNAME")
    config.secret("TRADINGVIEW_PASSWORD")
    config.authenticated_candidates_enabled()
    config.tradingview_credentials_available()

    captured = capsys.readouterr()
    assert "fake-user-token-abc123" not in captured.out
    assert "fake-user-token-abc123" not in captured.err
    assert "fake-pass-token-xyz789" not in captured.out
    assert "fake-pass-token-xyz789" not in captured.err
