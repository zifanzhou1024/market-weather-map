import scripts.shared.io as io
from scripts.shared.catalog import catalog_entries
from scripts.shared.io import download_text, parse_csv_rows, parse_float


def test_parse_float_handles_missing_dot_and_numeric_values():
    assert parse_float("") is None
    assert parse_float(".") is None
    assert parse_float("4.25") == 4.25


def test_parse_csv_rows_parses_observation_date_csv():
    rows = parse_csv_rows("observation_date,DGS10\n2026-04-30,4.25\n")

    assert rows == [{"observation_date": "2026-04-30", "DGS10": "4.25"}]


def test_download_text_retries_transient_timeouts(monkeypatch):
    attempts = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def read(self):
            return b"ok"

    def fake_urlopen(request, timeout):
        attempts.append((request, timeout))
        if len(attempts) == 1:
            raise TimeoutError("timed out")
        return FakeResponse()

    monkeypatch.setattr(io, "urlopen", fake_urlopen)

    assert download_text("https://example.com/data.csv") == "ok"
    assert len(attempts) == 2
    assert [attempt[0].get_header("User-agent") for attempt in attempts] == [
        "market-weather-map/0.1",
        None,
    ]
    assert [attempt[1] for attempt in attempts] == [30, 30]


def test_download_text_retries_with_provider_compatible_default_request(monkeypatch):
    attempts = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def read(self):
            return b"ok"

    def fake_urlopen(request, timeout):
        attempts.append((request.get_header("User-agent"), timeout))
        if len(attempts) == 1:
            raise TimeoutError("timed out")
        return FakeResponse()

    monkeypatch.setattr(io, "urlopen", fake_urlopen)

    assert download_text("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2") == "ok"
    assert attempts == [
        ("market-weather-map/0.1", 30),
        (None, 30),
    ]


def test_catalog_higher_is_values_match_frontend_contract():
    valid_values = {"supportive", "riskier", "contextual"}

    assert {entry["higher_is"] for entry in catalog_entries()} <= valid_values
