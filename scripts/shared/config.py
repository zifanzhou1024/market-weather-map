"""Read-only access to opt-in environment-variable secrets.

Used by Phase C TradingView authenticated-candidate fetchers to decide whether
to attempt a network call. The helpers never log or return the secret values
themselves to standard out, standard error, or any committed file. They expose
only presence/absence booleans to callers.

See ``docs/source_reviews/tradingview_authenticated_candidates.md`` for the
governance context and ``tests/python/test_secrets_isolation.py`` for the
allowlist + value-leak guarantees these helpers participate in.
"""
import os


def secret(name: str) -> str | None:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else None


def authenticated_candidates_enabled() -> bool:
    return os.environ.get("ENABLE_AUTHENTICATED_CANDIDATES", "").lower() == "true"


def tradingview_credentials_available() -> bool:
    return (
        authenticated_candidates_enabled()
        and secret("TRADINGVIEW_USERNAME") is not None
        and secret("TRADINGVIEW_PASSWORD") is not None
    )
