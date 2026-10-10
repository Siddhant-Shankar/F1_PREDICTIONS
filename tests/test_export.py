import numpy as np

from f1pred.export import _outline, _resample


def test_resample_is_evenly_spaced_by_distance():
    # points bunched at the start of a straight line, as a car's telemetry is
    # when it accelerates out of a slow corner
    x = np.r_[np.linspace(0, 1, 50), np.linspace(1, 100, 5)]
    xyz = np.stack([x, np.zeros_like(x), np.zeros_like(x)], axis=1)
    out = _resample(xyz, 11)
    assert np.allclose(np.diff(out[:, 0]), 10)


def test_outline_has_fixed_size_integer_points():
    t = np.linspace(0, 2 * np.pi, 300)
    track = np.stack([1000 * np.cos(t), 500 * np.sin(t), np.zeros_like(t)], axis=1).tolist()
    out = _outline(track)
    assert len(out) == 90
    assert all(isinstance(v, int) for p in out for v in p)
