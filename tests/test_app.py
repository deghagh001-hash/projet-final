import re
from playwright.sync_api import Page, expect
import pytest
import subprocess

# Define the Flask server process
FLASK_SERVER_URL = "http://127.0.0.1:5000"

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "accept_downloads": True
    }

@pytest.fixture(scope="session")
def flask_server():
    # Start the server
    server_process = subprocess.Popen(["python", "app.py"])
    # Wait for server to be ready
    yield
    # Teardown: terminate the server
    server_process.terminate()
    server_process.wait()

def test_full_conversion_flow(page: Page, flask_server):
    # Navigate to the app
    page.goto(FLASK_SERVER_URL)

    # 1. Check initial page state
    expect(page.locator("#video-url")).to_be_visible()
    expect(page.locator("#convert-btn")).to_be_visible()
    expect(page.locator("#audio-control-btn")).to_be_visible()

    # Verify that format buttons are disabled initially
    for button in page.locator(".format-btn").all():
        expect(button).to_be_disabled()

    # 2. Input a valid YouTube URL
    youtube_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    page.locator("#video-url").fill(youtube_url)

    # Verify that format buttons are enabled after entering a valid URL
    for button in page.locator(".format-btn").all():
        expect(button).to_be_enabled()

    # 3. Click the convert button
    page.locator("#convert-btn").click()

    # 4. Wait for the result and verify the download link
    # The result card should appear
    result_card = page.locator("#result-card")
    expect(result_card).to_be_visible(timeout=60000)

    # The download button should be visible
    download_btn = page.locator("#download-btn")
    expect(download_btn).to_be_visible()

    # By clicking the button and expecting a download, we test the functionality
    # more reliably than by inspecting the onclick attribute.
    with page.expect_download() as download_info:
        download_btn.click()

    download = download_info.value
    # Check that a file is being downloaded
    assert download is not None
    # Check that the file has the expected name (or part of it)
    assert "Rick Astley" in download.suggested_filename

    # 5. Verify that conversions left is updated
    conversions_left = page.locator("#conversions-left")
    expect(conversions_left).to_have_text("4")
