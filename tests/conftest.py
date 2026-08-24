import importlib.util


collect_ignore_glob = ["test_app.py"] if importlib.util.find_spec("playwright") is None else []
