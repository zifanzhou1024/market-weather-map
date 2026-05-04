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


def download_text(url: str) -> str:
    host = urlparse(url).netloc
    last_error: TimeoutError | None = None
    for request in _download_requests(url):
        try:
            with urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8-sig")
        except TimeoutError as error:
            last_error = error
            if request.get_header("User-agent") is not None and host:
                _HOSTS_REQUIRING_DEFAULT_REQUEST.add(host)
    if last_error is not None:
        raise last_error
    raise RuntimeError("download failed without an exception")
