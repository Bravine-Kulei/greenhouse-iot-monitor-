from thresholds import check_thresholds


def test_normal_values_produce_no_alerts():
    assert check_thresholds(24.0, 60.0) == []


def test_temp_above_max_produces_high_alert():
    alerts = check_thresholds(30.0, 60.0)
    assert len(alerts) == 1
    assert alerts[0].metric == "temperature"
    assert alerts[0].threshold == "high"
    assert "30.0" in alerts[0].message


def test_temp_below_min_produces_low_alert():
    alerts = check_thresholds(15.0, 60.0)
    assert len(alerts) == 1
    assert alerts[0].metric == "temperature"
    assert alerts[0].threshold == "low"
    assert "15.0" in alerts[0].message


def test_humidity_above_max_produces_high_alert():
    alerts = check_thresholds(24.0, 75.0)
    assert len(alerts) == 1
    assert alerts[0].metric == "humidity"
    assert alerts[0].threshold == "high"


def test_humidity_below_min_produces_low_alert():
    alerts = check_thresholds(24.0, 35.0)
    assert len(alerts) == 1
    assert alerts[0].metric == "humidity"
    assert alerts[0].threshold == "low"


def test_both_out_of_range_produces_two_alerts():
    alerts = check_thresholds(32.0, 80.0)
    assert len(alerts) == 2
    metrics = {a.metric for a in alerts}
    assert metrics == {"temperature", "humidity"}


def test_boundary_values_are_in_range():
    # 18°C, 28°C, 40%, 70% are all within range
    assert check_thresholds(18.0, 40.0) == []
    assert check_thresholds(28.0, 70.0) == []
