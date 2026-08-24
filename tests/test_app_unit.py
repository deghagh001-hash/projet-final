import json
import os
import time

import pytest

import app


@pytest.fixture(autouse=True)
def usage_db(monkeypatch, tmp_path):
    monkeypatch.setattr(app, "USAGE_DB", str(tmp_path / "usage.db"))
    app.init_usage_db()
    yield


def usage_count(ip_address, date=None):
    date = date or app.datetime.now().strftime("%Y-%m-%d")
    with app.closing(app._usage_connection()) as conn:
        row = conn.execute(
            "SELECT count FROM usage WHERE ip = ? AND date = ?", (ip_address, date)
        ).fetchone()
    return row[0] if row else 0


def set_usage(ip_address, count, date=None):
    date = date or app.datetime.now().strftime("%Y-%m-%d")
    with app.closing(app._usage_connection()) as conn:
        with conn:
            conn.execute(
                "INSERT INTO usage (ip, date, count) VALUES (?, ?, ?)",
                (ip_address, date, count),
            )


@pytest.fixture
def client():
    return app.app.test_client()


def sse_events(response):
    return [
        json.loads(line.removeprefix("data: "))
        for line in response.get_data(as_text=True).splitlines()
        if line.startswith("data: ")
    ]


def test_check_rate_limit_allows_unseen_ip():
    assert app.check_rate_limit("192.0.2.1") is True
    assert usage_count("192.0.2.1") == 0


def test_check_rate_limit_allows_count_below_daily_limit():
    set_usage("192.0.2.2", app.DAILY_LIMIT - 1)

    assert app.check_rate_limit("192.0.2.2") is True


def test_check_rate_limit_rejects_count_at_daily_limit():
    set_usage("192.0.2.3", app.DAILY_LIMIT)

    assert app.check_rate_limit("192.0.2.3") is False


def test_check_rate_limit_ignores_previous_days():
    set_usage("192.0.2.4", app.DAILY_LIMIT, date="2000-01-01")

    assert app.check_rate_limit("192.0.2.4") is True


def test_increment_usage_creates_then_increments_entry():
    app.increment_usage("192.0.2.5")
    app.increment_usage("192.0.2.5")

    assert usage_count("192.0.2.5") == 2


def test_usage_counts_persist_across_connections():
    app.increment_usage("192.0.2.6")

    assert usage_count("192.0.2.6") == 1


def test_purge_old_usage_keeps_only_today():
    set_usage("192.0.2.7", 3, date="2000-01-01")
    set_usage("192.0.2.8", 4)

    app.purge_old_usage()

    assert usage_count("192.0.2.7", date="2000-01-01") == 0
    assert usage_count("192.0.2.8") == 4


def test_security_headers_are_added(client):
    response = client.get("/")

    csp = response.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "object-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


def test_csp_allows_unsafe_eval_only_on_babel_react_route(client):
    babel_csp = client.get("/react").headers["Content-Security-Policy"]
    classic_csp = client.get("/").headers["Content-Security-Policy"]

    assert "'unsafe-eval'" in babel_csp
    assert "'unsafe-eval'" not in classic_csp
    assert "'unsafe-inline'" in classic_csp.split("script-src")[1].split(";")[0]


def test_csp_script_src_is_strict_on_other_routes():
    assert app.build_script_src("/react-app") == "'self'"
    assert "'unsafe-inline'" not in app.build_script_src("/downloads/x.mp4")


def test_index_page_renders(client):
    response = client.get("/")

    assert response.status_code == 200
    assert b"<title>" in response.data


def test_react_route_is_registered_with_existing_template():
    assert app.app.url_map.bind("localhost").match("/react") == ("react_version", {})
    assert app.app.jinja_loader.get_source(app.app.jinja_env, "react_index.html")


def test_download_file_serves_attachment(monkeypatch, tmp_path, client):
    monkeypatch.setattr(app, "DOWNLOAD_FOLDER", str(tmp_path))
    file_path = tmp_path / "example.mp4"
    file_path.write_bytes(b"video")

    response = client.get("/downloads/example.mp4")

    assert response.status_code == 200
    assert response.data == b"video"
    assert "attachment" in response.headers["Content-Disposition"]


def test_download_file_returns_not_found_for_missing_file(monkeypatch, tmp_path, client):
    monkeypatch.setattr(app, "DOWNLOAD_FOLDER", str(tmp_path))

    response = client.get("/downloads/missing.mp4")

    assert response.status_code == 404


def test_convert_rejects_rate_limited_client(client):
    set_usage("127.0.0.1", app.DAILY_LIMIT)

    response = client.post(
        "/api/convert",
        json={"url": "https://youtube.com/watch?v=video", "format": "mp4-1080p"},
    )

    assert response.status_code == 429
    assert "error" in response.get_json()


def test_convert_rejects_unsupported_domain(client):
    response = client.post(
        "/api/convert",
        json={"url": "https://example.com/x", "format": "mp4-1080p"},
    )

    assert response.status_code == 400
    assert "Domain not supported" in response.get_json()["error"]


def test_convert_success_streams_progress_and_increments_usage(
    monkeypatch, tmp_path, client
):
    monkeypatch.setattr(app, "DOWNLOAD_FOLDER", str(tmp_path))
    output_path = tmp_path / "video.mp4"

    class FakeYoutubeDL:
        def __init__(self, ydl_opts):
            self.ydl_opts = ydl_opts

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def extract_info(self, video_url, download):
            for hook in self.ydl_opts["progress_hooks"]:
                hook({"status": "downloading", "_percent_str": " 42.0%"})
                hook({"status": "downloading", "_percent_str": "not-a-number"})
                hook({"status": "finished"})
            output_path.write_bytes(b"video")
            return {"title": "video", "ext": "mp4"}

        def prepare_filename(self, info_dict):
            return str(output_path)

    monkeypatch.setattr(app.yt_dlp, "YoutubeDL", FakeYoutubeDL)

    response = client.post(
        "/api/convert",
        json={"url": "https://youtube.com/watch?v=video", "format": "mp4-1080p"},
    )

    events = sse_events(response)
    progress_values = [
        event["value"] for event in events if event["type"] == "progress"
    ]
    complete_events = [event for event in events if event["type"] == "complete"]
    assert progress_values == [42.0, 0, 100]
    assert complete_events == [{"type": "complete", "download_path": "downloads/video.mp4"}]
    assert usage_count("127.0.0.1") == 1


def test_convert_mp3_configures_audio_postprocessor_and_download_path(
    monkeypatch, tmp_path, client
):
    monkeypatch.setattr(app, "DOWNLOAD_FOLDER", str(tmp_path))
    output_path = tmp_path / "song.mp3"
    captured = {}

    class FakeYoutubeDL:
        def __init__(self, ydl_opts):
            captured["ydl_opts"] = ydl_opts

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def extract_info(self, video_url, download):
            output_path.write_bytes(b"audio")
            return {"title": "song", "ext": "webm"}

        def prepare_filename(self, info_dict):
            return str(tmp_path / "song.webm")

    monkeypatch.setattr(app.yt_dlp, "YoutubeDL", FakeYoutubeDL)

    response = client.post(
        "/api/convert",
        json={"url": "https://youtube.com/watch?v=audio", "format": "mp3-128k"},
    )

    postprocessor = captured["ydl_opts"]["postprocessors"][0]
    assert postprocessor["key"] == "FFmpegExtractAudio"
    assert postprocessor["preferredquality"] == "128"
    assert sse_events(response)[-1]["download_path"] == "downloads/song.mp3"


def test_convert_mp3_resolves_matching_glob_fallback(monkeypatch, tmp_path, client):
    monkeypatch.setattr(app, "DOWNLOAD_FOLDER", str(tmp_path))
    alternate_path = tmp_path / "song-final.mp3"

    class FakeYoutubeDL:
        def __init__(self, ydl_opts):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def extract_info(self, video_url, download):
            alternate_path.write_bytes(b"audio")
            return {"title": "song", "ext": "webm"}

        def prepare_filename(self, info_dict):
            return str(tmp_path / "song.webm")

    monkeypatch.setattr(app.yt_dlp, "YoutubeDL", FakeYoutubeDL)

    response = client.post(
        "/api/convert",
        json={"url": "https://youtube.com/watch?v=audio", "format": "mp3-128k"},
    )

    assert sse_events(response)[-1]["download_path"] == "downloads/song-final.mp3"


def test_convert_failure_streams_generic_error_and_does_not_increment(
    monkeypatch, tmp_path, client
):
    monkeypatch.setattr(app, "DOWNLOAD_FOLDER", str(tmp_path))

    class FakeYoutubeDL:
        def __init__(self, ydl_opts):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def extract_info(self, video_url, download):
            raise RuntimeError(f"download failed for {tmp_path}/secret.mp4")

    monkeypatch.setattr(app.yt_dlp, "YoutubeDL", FakeYoutubeDL)

    response = client.post(
        "/api/convert",
        json={"url": "https://youtube.com/watch?v=bad", "format": "mp4-1080p"},
    )

    errors = [event for event in sse_events(response) if event["type"] == "error"]
    assert errors
    # Les détails de l'exception (chemins, traces) ne doivent pas fuir vers le client.
    assert all("download failed" not in event["message"] for event in errors)
    assert usage_count("127.0.0.1") == 0


def test_convert_empty_file_streams_error_and_does_not_increment(
    monkeypatch, tmp_path, client
):
    monkeypatch.setattr(app, "DOWNLOAD_FOLDER", str(tmp_path))
    output_path = tmp_path / "empty.mp4"

    class FakeYoutubeDL:
        def __init__(self, ydl_opts):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def extract_info(self, video_url, download):
            output_path.write_bytes(b"")
            return {"title": "empty", "ext": "mp4"}

        def prepare_filename(self, info_dict):
            return str(output_path)

    monkeypatch.setattr(app.yt_dlp, "YoutubeDL", FakeYoutubeDL)

    response = client.post(
        "/api/convert",
        json={"url": "https://youtube.com/watch?v=empty", "format": "mp4-1080p"},
    )

    events = sse_events(response)
    assert any(event["type"] == "error" for event in events)
    assert usage_count("127.0.0.1") == 0


def test_cleanup_old_files_removes_only_files_older_than_ten_minutes(
    monkeypatch, tmp_path
):
    set_usage("192.0.2.9", 2, date="2000-01-01")
    monkeypatch.setattr(app, "DOWNLOAD_FOLDER", str(tmp_path))
    old_file = tmp_path / "old.mp4"
    fresh_file = tmp_path / "fresh.mp4"
    old_file.write_bytes(b"old")
    fresh_file.write_bytes(b"fresh")
    os.utime(old_file, (time.time() - 601, time.time() - 601))

    class StopCleanup(Exception):
        pass

    monkeypatch.setattr(app.time, "sleep", lambda seconds: (_ for _ in ()).throw(StopCleanup()))

    with pytest.raises(StopCleanup):
        app.cleanup_old_files()

    assert not old_file.exists()
    assert fresh_file.exists()
    assert usage_count("192.0.2.9", date="2000-01-01") == 0
