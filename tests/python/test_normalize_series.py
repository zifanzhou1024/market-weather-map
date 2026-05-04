from scripts.transform.normalize_series import normalize_observations


def test_normalize_observations_preserves_extra_fields_and_dedupes_by_date():
    observations = [
        {
            "date": "2024-01-03",
            "value": "bad",
            "percentile_252d": 0.1,
        },
        {
            "date": "2024-01-02",
            "value": "1.25",
            "percentile_252d": 0.2,
            "regime": "first",
        },
        {
            "date": "2024-01-01",
            "value": "3",
            "percentile_252d": 0.3,
        },
        {
            "date": "2024-01-02",
            "value": "2.5",
            "percentile_252d": 0.4,
            "regime": "later",
        },
        {
            "date": "",
            "value": "9",
            "percentile_252d": 0.5,
        },
    ]

    normalized = normalize_observations(observations)

    assert normalized == [
        {
            "date": "2024-01-01",
            "value": 3.0,
            "percentile_252d": 0.3,
        },
        {
            "date": "2024-01-02",
            "value": 2.5,
            "percentile_252d": 0.4,
            "regime": "later",
        },
    ]
