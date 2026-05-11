from __future__ import annotations

import csv
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def normalize_two_column_csv(
    rows: list[dict[str, str]],
    *,
    date_column: str,
    value_column: str,
    label: str,
    require_iso_date: bool = True,
) -> list[dict[str, object]]:
    """Normalize a two-column CSV (date + numeric value) into TimeSeriesFile observations.

    Raises ValueError with `label` in the message on shape/content problems.
    Returns observations sorted by date ascending; rows whose value parses to None are skipped.
    """
    if not rows:
        raise ValueError(f"no rows returned for {label}")
    if date_column not in rows[0] or value_column not in rows[0]:
        raise ValueError(
            f"missing expected {date_column}/{value_column} columns for {label}; got {list(rows[0])}"
        )
    observations: list[dict[str, object]] = []
    for row in rows:
        raw_date = row.get(date_column)
        raw_value = row.get(value_column)
        try:
            value = parse_float(raw_value)
        except ValueError as error:
            raise ValueError(
                f"invalid numeric value for {label}: {raw_value}"
            ) from error
        if value is None:
            continue
        if not raw_date:
            raise ValueError(f"missing {date_column} for {label} row")
        date_text = raw_date.strip()
        if require_iso_date:
            try:
                datetime.strptime(date_text, "%Y-%m-%d")
            except ValueError as error:
                raise ValueError(
                    f"invalid ISO date for {label}: {raw_date}"
                ) from error
        observations.append({"date": date_text, "value": value})
    if not observations:
        raise ValueError(f"no observations parsed for {label}")
    observations.sort(key=lambda item: str(item["date"]))
    return observations


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def data_dir() -> Path:
    return repo_root() / "public" / "data"


def write_json(path: Path | str, payload: Any) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(tmp_name, target)
    except Exception:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass
        raise


def parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    normalized = value.strip()
    if normalized in {"", ".", "NA", "N/A"}:
        return None
    return float(normalized.replace(",", ""))


def parse_csv_rows(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(text.splitlines()))


def series_path(series_id: str) -> Path:
    return data_dir() / "series" / f"{series_id}.json"


_HOSTS_REQUIRING_DEFAULT_REQUEST: set[str] = set()


def _download_requests(url: str) -> list[Request]:
    custom = Request(url, headers={"User-Agent": "market-weather-map/0.1"})
    provider_default = Request(url)
    host = urlparse(url).netloc
    if host in _HOSTS_REQUIRING_DEFAULT_REQUEST:
        return [provider_default, custom]
    return [custom, provider_default]


def _download_raw(url: str, *, timeout: int = 30) -> bytes:
    """Download URL and return raw bytes; tries custom UA first, falls back to default."""
    host = urlparse(url).netloc
    last_error: TimeoutError | None = None
    for request in _download_requests(url):
        try:
            with urlopen(request, timeout=timeout) as response:
                return response.read()
        except TimeoutError as error:
            last_error = error
            if request.get_header("User-agent") is not None and host:
                _HOSTS_REQUIRING_DEFAULT_REQUEST.add(host)
    if last_error is not None:
        raise last_error
    raise RuntimeError("download failed without an exception")


def download_text(url: str, *, timeout: int = 30) -> str:
    """Download URL and return text (UTF-8, BOM-stripped)."""
    return _download_raw(url, timeout=timeout).decode("utf-8-sig")


def download_bytes(url: str, *, timeout: int = 30) -> bytes:
    """Download URL and return raw bytes; for binary formats such as .xls."""
    return _download_raw(url, timeout=timeout)
