import argparse

import uvicorn


def main() -> None:
    p = argparse.ArgumentParser(description="Typst web server")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--reload", action="store_true")
    a = p.parse_args()
    uvicorn.run("typst_server.app:app", host=a.host, port=a.port, reload=a.reload)
