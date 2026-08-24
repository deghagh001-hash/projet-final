import json

import pytest

import converter


@pytest.mark.parametrize(
    "domain",
    ["youtube.com", "youtu.be", "tiktok.com", "instagram.com", "twitch.tv"],
)
def test_is_supported_url_accepts_allowed_domains(domain):
    assert converter.is_supported_url(f"https://{domain}/video") is True


@pytest.mark.parametrize("video_url", ["https://example.com/video", "", None])
def test_is_supported_url_rejects_invalid_urls(video_url):
    assert converter.is_supported_url(video_url) is False


@pytest.mark.parametrize(
    ("requested_format", "height"),
    [("mp4-1080p", 1080), ("mp4-720p", 720), ("mp4-480p", 480)],
)
def test_build_ydl_opts_configures_mp4_presets(tmp_path, requested_format, height):
    progress_hook = object()

    opts = converter.build_ydl_opts(requested_format, str(tmp_path), progress_hook)

    assert opts["outtmpl"] == f"{tmp_path}/%(title)s.%(ext)s"
    assert opts["quiet"] is True
    assert opts["no_warnings"] is True
    assert opts["progress_hooks"] == [progress_hook]
    assert opts["format"] == converter.FORMAT_PRESETS[requested_format]["format"]
    assert f"height<={height}" in opts["format"]
    assert "postprocessors" not in opts


@pytest.mark.parametrize(
    ("requested_format", "quality"),
    [("mp3-128k", "128"), ("mp3-320k", "320")],
)
def test_build_ydl_opts_configures_mp3_presets(tmp_path, requested_format, quality):
    opts = converter.build_ydl_opts(requested_format, str(tmp_path), lambda _: None)

    assert opts["format"] == "bestaudio/best"
    assert opts["postprocessors"] == [
        {
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": quality,
        }
    ]


def test_build_ydl_opts_configures_wav_without_quality(tmp_path):
    opts = converter.build_ydl_opts("wav", str(tmp_path), lambda _: None)

    assert opts["format"] == "bestaudio/best"
    assert opts["postprocessors"] == [
        {"key": "FFmpegExtractAudio", "preferredcodec": "wav"}
    ]
    assert "preferredquality" not in opts["postprocessors"][0]


def test_build_ydl_opts_uses_default_for_unknown_format(tmp_path):
    opts = converter.build_ydl_opts("flac", str(tmp_path), lambda _: None)

    assert opts["format"] == converter.DEFAULT_VIDEO_FORMAT
    assert "postprocessors" not in opts


class FakeYDL:
    def __init__(self, filename):
        self.filename = filename

    def prepare_filename(self, info_dict):
        return str(self.filename)


def test_resolve_final_filename_without_postprocessors(tmp_path):
    filename = tmp_path / "video.mp4"

    result = converter.resolve_final_filename(FakeYDL(filename), {}, {}, str(tmp_path))

    assert result == str(filename)


def test_resolve_final_filename_returns_existing_swapped_extension(tmp_path):
    filename = tmp_path / "video.webm"
    swapped_filename = tmp_path / "video.mp3"
    swapped_filename.write_bytes(b"audio")
    ydl_opts = {"postprocessors": [{"preferredcodec": "mp3"}]}

    result = converter.resolve_final_filename(
        FakeYDL(filename), {}, ydl_opts, str(tmp_path)
    )

    assert result == str(swapped_filename)


def test_resolve_final_filename_uses_most_recent_matching_prefix(
    monkeypatch, tmp_path
):
    filename = tmp_path / "video.webm"
    older_match = tmp_path / "video-alt.mp3"
    newer_match = tmp_path / "video-processed.mp3"
    older_match.write_bytes(b"old")
    newer_match.write_bytes(b"new")
    ctimes = {str(older_match): 10, str(newer_match): 20}
    monkeypatch.setattr(converter.os.path, "getctime", lambda path: ctimes[path])
    ydl_opts = {"postprocessors": [{"preferredcodec": "mp3"}]}

    result = converter.resolve_final_filename(
        FakeYDL(filename), {}, ydl_opts, str(tmp_path)
    )

    assert result == str(newer_match)


def test_resolve_final_filename_uses_recent_fallback(monkeypatch, tmp_path):
    filename = tmp_path / "video.webm"
    recent_file = tmp_path / "unrelated.bin"
    recent_file.write_bytes(b"new")
    monkeypatch.setattr(converter.time, "time", lambda: 1000)
    monkeypatch.setattr(converter.os.path, "getctime", lambda path: 995)
    ydl_opts = {"postprocessors": [{"preferredcodec": "mp3"}]}

    result = converter.resolve_final_filename(
        FakeYDL(filename), {}, ydl_opts, str(tmp_path)
    )

    assert result == str(recent_file)


def test_resolve_final_filename_raises_when_no_file_can_be_resolved(tmp_path):
    filename = tmp_path / "video.webm"
    ydl_opts = {"postprocessors": [{"preferredcodec": "mp3"}]}

    with pytest.raises(Exception, match="Could not determine final filename"):
        converter.resolve_final_filename(
            FakeYDL(filename), {}, ydl_opts, str(tmp_path)
        )


def test_sse_event_has_parseable_wire_format():
    payload = {"type": "progress", "value": 42}

    result = converter.sse_event(payload)

    assert result == f"data: {json.dumps(payload)}\n\n"
    assert json.loads(result[len("data: ") : -2]) == payload


def test_sse_error_has_parseable_wire_format():
    result = converter.sse_error("conversion failed")

    assert result == (
        'data: {"type": "error", "message": "conversion failed"}\n\n'
    )
    assert json.loads(result[len("data: ") : -2]) == {
        "type": "error",
        "message": "conversion failed",
    }
