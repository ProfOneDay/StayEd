from __future__ import annotations

import time

# In-process sliding-window limiter for auth endpoints (login, password
# change/reset, OTP requests). Same trade-off as learner_routes'
# _LOOKUP_ATTEMPTS: resets on restart and isn't shared across worker
# processes -- fine for the current single-process deployment; move to a
# shared store (e.g. Redis) if that ever changes.
_ATTEMPTS: dict[str, list[float]] = {}
_MAX_WINDOW_SECONDS = 60 * 60


def _recent(key: str, window_seconds: int) -> list[float]:
    cutoff = time.time() - window_seconds
    attempts = [t for t in _ATTEMPTS.get(key, []) if t >= cutoff]
    if attempts:
        _ATTEMPTS[key] = attempts
    else:
        _ATTEMPTS.pop(key, None)
    return attempts


def is_limited(key: str, limit: int, window_seconds: int) -> bool:
    """True when `key` already has `limit` attempts inside the window.
    Doesn't record anything -- pair with record() for failure-only counting
    (e.g. only wrong passwords count against a login)."""
    return len(_recent(key, window_seconds)) >= limit


def record(key: str, window_seconds: int) -> None:
    attempts = _recent(key, window_seconds)
    attempts.append(time.time())
    _ATTEMPTS[key] = attempts

    # Opportunistic sweep so keys that never come back don't pile up.
    # Uses the longest window any caller uses, so a sweep triggered by a
    # short-window bucket never drops another bucket's still-live entries.
    if len(_ATTEMPTS) > 5000:
        for stale in [k for k in list(_ATTEMPTS) if not _recent(k, _MAX_WINDOW_SECONDS)]:
            _ATTEMPTS.pop(stale, None)


def hit(key: str, limit: int, window_seconds: int) -> bool:
    """Record an attempt and report whether it went over the limit -- for
    endpoints where every call counts (e.g. requesting a code)."""
    if is_limited(key, limit, window_seconds):
        return True
    record(key, window_seconds)
    return False


def clear(key: str) -> None:
    _ATTEMPTS.pop(key, None)
