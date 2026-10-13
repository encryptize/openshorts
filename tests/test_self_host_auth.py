"""Self-hosted shared-password auth + clip library (ACCESS_PASSWORD).

Tests the stdlib HS256 JWT, the login/me/history endpoints, and the
process/history auth gates — all in self-host mode (BILLING_ENABLED=0,
set by conftest before app is imported).
"""
import asyncio
import os

import httpx
import pytest

app_module = pytest.importorskip("app")


# ---- helpers -----------------------------------------------------------------

@pytest.fixture(autouse=True)
def clean_jobs(monkeypatch):
    """Each test starts with an empty jobs dict (restored after)."""
    monkeypatch.setattr(app_module, "jobs", {})


def _client():
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_module.app),
        base_url="http://testserver")


def _get(path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async def _do():
        async with _client() as c:
            return await c.get(path, headers=headers)
    return asyncio.run(_do())


def _post_json(path, body, token=None, extra_headers=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if extra_headers:
        headers.update(extra_headers)

    async def _do():
        async with _client() as c:
            return await c.post(path, json=body, headers=headers)
    return asyncio.run(_do())


@pytest.fixture()
def with_password(monkeypatch):
    """Enable ACCESS_PASSWORD for a test, restore after."""
    monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "test123")
    yield
    monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "")


@pytest.fixture()
def dirs(tmp_path, monkeypatch):
    out_root = tmp_path / "output"
    up_root = tmp_path / "uploads"
    out_root.mkdir()
    up_root.mkdir()
    monkeypatch.setattr(app_module, "OUTPUT_DIR", str(out_root))
    monkeypatch.setattr(app_module, "UPLOAD_DIR", str(up_root))
    return out_root, up_root


def _login(password="test123"):
    return _post_json("/api/auth/login", {"password": password})


def _fake_completed_job(job_id="job-fake-1", clips=None):
    """Insert a minimal completed job into the in-memory store."""
    app_module.jobs[job_id] = {
        "status": "completed",
        "output_dir": os.path.join(app_module.OUTPUT_DIR, job_id),
        "user_id": "selfhost",
        "result": {"clips": clips or [
            {"video_url": f"/videos/{job_id}/clip_0.mp4",
             "video_title_for_youtube_short": "Viral Title"},
            {"video_url": f"/videos/{job_id}/clip_1.mp4",
             "viral_hook_text": "Hook Text"},
        ]},
    }
    os.makedirs(app_module.jobs[job_id]["output_dir"], exist_ok=True)
    return job_id


# ---- 1. login flow ------------------------------------------------------------

class TestLogin:
    def test_correct_password(self, with_password):
        resp = _login("test123")
        assert resp.status_code == 200
        assert "token" in resp.json()

    def test_wrong_password(self, with_password):
        resp = _login("wrong")
        assert resp.status_code == 401

    def test_login_open_mode(self, monkeypatch):
        """Without ACCESS_PASSWORD, login still works (open access)."""
        monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "")
        resp = _login("anything")
        assert resp.status_code == 200
        assert "token" in resp.json()


# ---- 2. protected endpoints without token ------------------------------------

class TestProtectedWithoutToken:
    def test_history_401(self, with_password):
        assert _get("/api/history").status_code == 401

    def test_me_401(self, with_password):
        assert _get("/api/me").status_code == 401

    def test_process_401(self, with_password, dirs, monkeypatch):
        # Set up a thumbnail session so /api/process gets past the source
        # check and reaches reserve_process_minutes (which raises 401).
        _, up_root = dirs
        video = up_root / "sess_source.mp4"
        video.write_bytes(b"fake")
        monkeypatch.setitem(app_module.thumbnail_sessions, "s1", {
            "user_id": None, "video_path": str(video),
            "transcript_ready": False, "transcript": None,
        })
        resp = _post_json("/api/process", {
            "thumbnail_session_id": "s1", "acknowledged": True,
        }, extra_headers={"X-Gemini-Key": "test-key"})
        assert resp.status_code == 401


# ---- 3. protected endpoints with token ---------------------------------------

class TestProtectedWithToken:
    def test_history_200(self, with_password, dirs):
        token = _login("test123").json()["token"]
        _fake_completed_job()
        resp = _get("/api/history", token=token)
        assert resp.status_code == 200
        vids = resp.json()["videos"]
        assert len(vids) == 2
        assert vids[0]["title"] in ("Viral Title", "Hook Text")
        assert vids[0]["view_url"].startswith("/videos/")

    def test_me_200(self, with_password):
        token = _login("test123").json()["token"]
        resp = _get("/api/me", token=token)
        assert resp.status_code == 200
        body = resp.json()
        assert body["user"] == "selfhost"
        assert body["entitled"] is True

    def test_projects_empty(self, with_password):
        token = _login("test123").json()["token"]
        resp = _get("/api/projects", token=token)
        assert resp.status_code == 200
        assert resp.json() == {"projects": []}

    def test_history_excludes_non_completed(self, with_password, dirs):
        token = _login("test123").json()["token"]
        _fake_completed_job(job_id="done")
        app_module.jobs["processing"] = {
            "status": "processing", "output_dir": "",
            "result": {"clips": [{"video_url": "/videos/x/y.mp4"}]},
        }
        resp = _get("/api/history", token=token)
        vids = resp.json()["videos"]
        assert all(v["job_id"] == "done" for v in vids)


# ---- 4. open mode (no ACCESS_PASSWORD) ---------------------------------------

class TestOpenMode:
    def test_history_200_no_auth(self, monkeypatch, dirs):
        monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "")
        _fake_completed_job()
        resp = _get("/api/history")
        assert resp.status_code == 200
        assert len(resp.json()["videos"]) == 2

    def test_me_200_no_auth(self, monkeypatch):
        monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "")
        resp = _get("/api/me")
        assert resp.status_code == 200
        assert resp.json()["user"] == "selfhost"


# ---- 5. /api/config -----------------------------------------------------------

class TestConfig:
    def test_config_password_set(self, with_password):
        resp = _get("/api/config")
        assert resp.status_code == 200
        assert resp.json()["accessPasswordRequired"] is True

    def test_config_password_unset(self, monkeypatch):
        monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "")
        resp = _get("/api/config")
        assert resp.status_code == 200
        assert resp.json()["accessPasswordRequired"] is False


# ---- 6. token longevity / tamper ---------------------------------------------

class TestJwt:
    def test_issue_and_verify(self, with_password):
        token = app_module._issue_self_host_jwt()
        assert app_module._verify_self_host_jwt(token) is True

    def test_tampered_rejected(self, with_password):
        token = app_module._issue_self_host_jwt()
        parts = token.split(".")
        tampered = parts[0] + "." + parts[1] + "." + app_module._b64url_encode(b"x")
        assert app_module._verify_self_host_jwt(tampered) is False

    def test_expired_rejected(self, with_password):
        token = app_module._issue_self_host_jwt(ttl_days=-1)
        assert app_module._verify_self_host_jwt(token) is False

    def test_wrong_secret_rejected(self, with_password, monkeypatch):
        token = app_module._issue_self_host_jwt()
        monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "different")
        assert app_module._verify_self_host_jwt(token) is False

    def test_jwt_secret_env_override(self, monkeypatch):
        """JWT_SECRET env var takes precedence over ACCESS_PASSWORD-derived."""
        monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "pw1")
        monkeypatch.setenv("JWT_SECRET", "stable-secret")
        token = app_module._issue_self_host_jwt()
        # Changing the password must NOT invalidate tokens when JWT_SECRET is set.
        monkeypatch.setattr(app_module, "ACCESS_PASSWORD", "pw2")
        assert app_module._verify_self_host_jwt(token) is True