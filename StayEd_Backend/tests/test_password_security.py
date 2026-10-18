"""Password-change OTP, forgot/reset email, and auth rate limits -- run
against a tiny in-memory stand-in for the database so no Postgres is
needed."""
from datetime import datetime, timezone

import pytest
from flask_jwt_extended import create_access_token
from werkzeug.security import check_password_hash, generate_password_hash

from app import create_app
from app.routes import admin_routes, auth_routes
from app.services import rate_limit


class FakeDB:
    """Just enough of fetch_one/execute/get_db for auth_routes' queries."""

    def __init__(self):
        self.users = {1: {"user_id": 1, "email": "teacher@deped.gov.ph", "first_name": "Ana",
                          "role": "TEACHER", "account_status": "ACTIVE", "must_change_password": False,
                          "password_hash": generate_password_hash("OldPass1")}}
        self.otps = []
        self.tokens = []

    def _now(self):
        return datetime.now(timezone.utc)

    def run(self, query, params):
        q = " ".join(query.split())
        if q.startswith("UPDATE users SET password_hash"):
            user = self.users[params[1]]
            user["password_hash"] = params[0]
            if "must_change_password=TRUE" in q.replace(" ", ""):
                user["must_change_password"] = True
            elif "must_change_password" in q:
                user["must_change_password"] = False
        elif q.startswith("UPDATE password_change_otp SET used_at = CURRENT_TIMESTAMP WHERE user_id"):
            for o in self.otps:
                if o["user_id"] == params[0] and o["used_at"] is None:
                    o["used_at"] = self._now()
        elif q.startswith("INSERT INTO password_change_otp"):
            self.otps.append({"otp_id": len(self.otps) + 1, "user_id": params[0], "code_hash": params[1],
                              "expires_at": params[2], "attempts": 0, "used_at": None})
        elif q.startswith("UPDATE password_change_otp SET attempts = %s, used_at"):
            o = self.otps[params[1] - 1]
            o["attempts"], o["used_at"] = params[0], self._now()
        elif q.startswith("UPDATE password_change_otp SET attempts"):
            self.otps[params[1] - 1]["attempts"] = params[0]
        elif q.startswith("UPDATE password_change_otp SET used_at = CURRENT_TIMESTAMP WHERE otp_id"):
            self.otps[params[0] - 1]["used_at"] = self._now()
        elif q.startswith("UPDATE password_reset_token SET used_at"):
            for t in self.tokens:
                if t["user_id"] == params[0] and t["used_at"] is None:
                    t["used_at"] = self._now()
        elif q.startswith("INSERT INTO password_reset_token"):
            self.tokens.append({"reset_id": len(self.tokens) + 1, "user_id": params[0], "token": params[1],
                                "expires_at": params[2], "used_at": None})
        else:
            raise AssertionError(f"Unexpected write: {q}")

    def fetch_one(self, query, params=()):
        q = " ".join(query.split())
        if q.startswith("SELECT password_hash FROM users"):
            return self.users.get(params[0])
        if "FROM users u LEFT JOIN teacher t" in q and "WHERE u.user_id" in q:
            return self.users.get(params[0])
        if "FROM users u LEFT JOIN teacher t" in q and "LOWER(u.email)" in q:
            return next((u for u in self.users.values() if u["email"] == params[0].lower()), None)
        if q.startswith("SELECT user_id FROM users WHERE LOWER(email)"):
            return next((u for u in self.users.values() if u["email"] == params[0].lower()), None)
        if "FROM password_change_otp" in q:
            live = [o for o in self.otps if o["user_id"] == params[0] and o["used_at"] is None
                    and o["expires_at"] > self._now()]
            return live[-1] if live else None
        if "FROM password_reset_token" in q:
            return next((t for t in self.tokens if t["token"] == params[0] and t["used_at"] is None
                         and t["expires_at"] > self._now()), None)
        raise AssertionError(f"Unexpected read: {q}")

    def get_db(self):
        db = self

        class Cursor:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def execute(self, query, params=()):
                db.run(query, params)

        class Conn:
            def cursor(self):
                return Cursor()

            def commit(self):
                pass

            def rollback(self):
                pass

        return Conn()


@pytest.fixture
def env(monkeypatch):
    fake = FakeDB()
    sent = []
    monkeypatch.setattr(auth_routes, "fetch_one", fake.fetch_one)
    monkeypatch.setattr(auth_routes, "execute", lambda q, p=(): fake.run(q, p))
    monkeypatch.setattr(auth_routes, "get_db", fake.get_db)
    monkeypatch.setattr(auth_routes, "send_email", lambda **kw: sent.append(kw) or True)
    monkeypatch.setattr(admin_routes, "fetch_one", fake.fetch_one)
    monkeypatch.setattr(admin_routes, "execute", lambda q, p=(): fake.run(q, p))
    monkeypatch.setattr(admin_routes, "send_email", lambda *a, **kw: sent.append({"to": a[0], "subject": a[1], "body": a[2]}) or True)
    rate_limit._ATTEMPTS.clear()

    app = create_app()
    app.config.update(TESTING=True, DEBUG=False)
    client = app.test_client()
    with app.app_context():
        token = create_access_token(identity="1", additional_claims={"role": "teacher"})
    headers = {"Authorization": f"Bearer {token}"}
    return fake, sent, client, headers


def _code_from(email):
    return email["subject"].split()[0]


def test_change_password_needs_the_emailed_code(env):
    fake, sent, client, headers = env
    body = {"current_password": "OldPass1", "password": "NewPass22"}

    res = client.post("/api/auth/change-password/request-code", json=body, headers=headers)
    assert res.status_code == 200, res.get_json()
    assert "devCode" not in res.get_json()  # never leaked outside debug
    assert sent[-1]["to"] == "teacher@deped.gov.ph"
    code = _code_from(sent[-1])

    wrong = "000000" if code != "000000" else "111111"
    res = client.post("/api/auth/change-password", json={**body, "code": wrong}, headers=headers)
    assert res.status_code == 422
    assert "4 tries left" in res.get_json()["message"]
    assert check_password_hash(fake.users[1]["password_hash"], "OldPass1")

    res = client.post("/api/auth/change-password", json={**body, "code": code}, headers=headers)
    assert res.status_code == 200, res.get_json()
    assert check_password_hash(fake.users[1]["password_hash"], "NewPass22")
    assert sent[-1]["subject"] == "Your StayEd password was changed"

    # The code is single-use.
    res = client.post("/api/auth/change-password", json={**body, "code": code}, headers=headers)
    assert res.status_code == 422


def test_code_dies_after_five_wrong_tries(env):
    fake, sent, client, headers = env
    body = {"current_password": "OldPass1", "password": "NewPass22"}
    client.post("/api/auth/change-password/request-code", json=body, headers=headers)
    code = _code_from(sent[-1])
    wrong = "000000" if code != "000000" else "111111"

    for _ in range(5):
        res = client.post("/api/auth/change-password", json={**body, "code": wrong}, headers=headers)
    assert "request a new one" in res.get_json()["message"]

    res = client.post("/api/auth/change-password", json={**body, "code": code}, headers=headers)
    assert res.status_code == 422
    assert check_password_hash(fake.users[1]["password_hash"], "OldPass1")


def test_wrong_current_password_is_rate_limited(env):
    _, _, client, headers = env
    body = {"current_password": "Wrong1234", "password": "NewPass22"}
    codes = [client.post("/api/auth/change-password/request-code", json=body, headers=headers).status_code
             for _ in range(6)]
    assert codes == [422] * 5 + [429]


def test_weak_new_password_is_rejected_server_side(env):
    _, sent, client, headers = env
    res = client.post("/api/auth/change-password/request-code",
                      json={"current_password": "OldPass1", "password": "alllowercase"}, headers=headers)
    assert res.status_code == 422
    assert not sent


def test_login_locks_after_repeated_failures(env):
    _, _, client, _ = env
    body = {"email": "bot@example.com", "password": "guess"}
    codes = [client.post("/api/auth/login", json=body).status_code for _ in range(11)]
    assert codes == [401] * 10 + [429]


def test_forgot_password_emails_a_working_reset_link(env):
    fake, sent, client, _ = env

    res = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert res.status_code == 200 and not sent  # same answer, nothing sent

    res = client.post("/api/auth/forgot-password", json={"email": "Teacher@DepEd.gov.ph"})
    assert res.status_code == 200
    assert "reset_token" not in res.get_json()
    token = fake.tokens[-1]["token"]
    assert f"reset-password.html?token={token}" in sent[-1]["body"]

    res = client.post("/api/auth/reset-password", json={"token": token, "password": "Brand9New"})
    assert res.status_code == 200, res.get_json()
    assert check_password_hash(fake.users[1]["password_hash"], "Brand9New")

    res = client.post("/api/auth/reset-password", json={"token": token, "password": "Brand9New"})
    assert res.status_code == 422  # link is single-use


def test_admin_reset_emails_temp_password_and_forces_a_change(env):
    fake, sent, client, _ = env
    with client.application.app_context():
        admin_token = create_access_token(
            identity="99", additional_claims={"role": "admin", "is_super_admin": True}
        )
    res = client.post("/api/admin/users/1/reset-password", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200, res.get_json()
    temp = res.get_json()["temp_password"]
    assert res.get_json()["email_sent"] is True
    assert sent[-1]["to"] == "teacher@deped.gov.ph"
    assert temp in sent[-1]["body"]
    assert fake.users[1]["must_change_password"] is True

    # Logging in with it works, but the token can't be used for anything else...
    res = client.post("/api/auth/login", json={"email": "teacher@deped.gov.ph", "password": temp})
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["user"]["mustChangePassword"] is True
    headers = {"Authorization": f"Bearer {res.get_json()['token']}"}
    res = client.post("/api/auth/change-password/request-code",
                      json={"current_password": temp, "password": "Mine12345"}, headers=headers)
    assert res.status_code == 403
    assert res.get_json()["code"] == "PASSWORD_CHANGE_REQUIRED"

    # ...until the user picks their own password.
    res = client.post("/api/auth/set-initial-password",
                      json={"current_password": "wrong", "password": "Mine12345"}, headers=headers)
    assert res.status_code == 422
    res = client.post("/api/auth/set-initial-password",
                      json={"current_password": temp, "password": "Mine12345"}, headers=headers)
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["user"]["mustChangePassword"] is False
    assert fake.users[1]["must_change_password"] is False
    assert check_password_hash(fake.users[1]["password_hash"], "Mine12345")

    # The fresh token is no longer restricted.
    new_headers = {"Authorization": f"Bearer {res.get_json()['token']}"}
    res = client.post("/api/auth/change-password/request-code",
                      json={"current_password": "Mine12345", "password": "Other9876"}, headers=new_headers)
    assert res.status_code == 200, res.get_json()
