"""Local dev static file server that disables browser caching.

python -m http.server sends no Cache-Control headers, so browsers fall back
to heuristic caching and can keep serving stale JS/HTML after an edit even
across normal reloads. This wrapper forces every response to be revalidated.
"""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
