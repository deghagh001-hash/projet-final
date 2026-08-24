import json
import os
import time

import pytest

import app


@pytest.fixture(autouse=True)
def clear_client_usage():
    app.clients_usage.clear()
    yield
    app.clients_usage.clear()


@pytest.fixture
def client():
    return app.app.test_client()


def sse_events(response):
    return [
        json.loads(line.removeprefix("data: "))
        for line in response.get_data(as_text=True).splitlines()
        if line.startswith("data: ")
    ]


def test_check_rate_limit_registers_unseen_ip():
    assert app.check_rate_limit("192.0.2.1") is True
    assert app.clients_usage["192.0.2.1"]["count"] == 0


def test_check_rate_limit_allows_count_below_daily_limit():
    app.clients_usage["192.0.2.2"] = {
        "date": app.datetime.now().strftime("%Y-%m-%d"),
        "count": app.DAILY_LIMIT - 1,
    }

    assert app.check_rate_limit("192.0.2.2") is True


def test_check_rate_limit_rejects_count_at_daily_limit():
    app.clients_usage["192.0.2.3"] = {
        "date": app.datetime.now().strftime("%Y-%m-%d"),
        "count": app.DAILY_LIMIT,
    }

    assert app.check_rate_limit("192.0.2.3") is False


def test_check_rate_limit_resets_stale_entry():
    app.clients_usage["192.0.2.4"] = {"date": "2000-01-01", "count": app.DAILY_LIMIT}

    assert app.check_rate_limit("192.0.2.4") is True
    assert app.clients_usage["192.0.2.4"]["count"] == 0
    assert app.clients_usage["192.0.2.4"]["date"] == app.datetime.now().strftime("%Y-%m-%d")


def test_increment_usage_increments_existing_ip():
    app.clients_usage["192.0.2.5"] = {"date": "today", "count": 2}

    app.increment_usage("192.0.2.5")

    assert app.clients_usage["192.0.2.5"]["count"] == 3


def test_increment_usage_ignores_unknown_ip():
    app.increment_usage("192.0.2.6")


def test_security_headers_are_added(client):
    response = client.get("/")

    csp = response.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "object-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


def test_index_page_renders(client):
    response = client.get("/")

    assert response.status_code == 200
    assert b"<title>" in response.data


def test_react_page_renders_existing_template(monkeypatch, client):
    template_source, _, _ = app.app.jinja_loader.get_source(
        app.app.jinja_env, "react_index.html"
    )
    monkeypatch.setattr(app, "render_template", lambda template_name: template_source)

    response = client.get("/react")

    assert response.status_code == 200
    assert b"<title>" in response.data


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
    app.clients_usage["127.0.0.1"] = {
        "date": app.datetime.now().strftime("%Y-%m-%d"),
        "count": app.DAILY_LIMIT,
    }

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

    events = sse_events(response)
    assert any(
        event["type"] == "error" and "Domain not supported" in event["message"]
        for event in events
    )


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
    assert app.clients_usage["127.0.0.1"]["count"] == 1


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


def test_convert_failure_streams_exception_and_does_not_increment(
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
            raise RuntimeError("download failed")

    monkeypatch.setattr(app.yt_dlp, "YoutubeDL", FakeYoutubeDL)

    response = client.post(
        "/api/convert",
        json={"url": "https://youtube.com/watch?v=bad", "format": "mp4-1080p"},
    )

    events = sse_events(response)
    assert any(
        event["type"] == "error" and "download failed" in event["message"]
        for event in events
    )
    assert app.clients_usage["127.0.0.1"]["count"] == 0


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
    assert app.clients_usage["127.0.0.1"]["count"] == 0


def test_cleanup_old_files_removes_only_files_older_than_ten_minutes(
    monkeypatch, tmp_path
):
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
