#!/usr/bin/env python3
"""
Local server for the gaze tracker demo.

It serves static files from the current directory and exposes:
  /proxy?url=<http(s)-url>

The proxy endpoint fetches remote HTML, injects a <base> tag, and rewrites
links/forms so in-frame navigation continues through /proxy.
"""

from __future__ import annotations

import argparse
import html
import re
import socketserver
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler


HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


def ensure_http_url(raw_url: str) -> str:
    value = (raw_url or "").strip()
    if not value:
        raise ValueError("Missing url query parameter.")

    if not re.match(r"^[a-zA-Z][a-zA-Z\d+\-.]*:", value):
        value = f"https://{value}"

    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs are supported.")
    if not parsed.netloc:
        raise ValueError("Invalid URL.")
    return value


def rewrite_html_for_proxy(html_text: str, final_url: str) -> str:
    base_tag = f'<base href="{html.escape(final_url, quote=True)}">'

    if re.search(r"<head[^>]*>", html_text, flags=re.IGNORECASE):
        html_text = re.sub(
            r"(<head[^>]*>)",
            rf"\1{base_tag}",
            html_text,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        html_text = base_tag + html_text

    html_text = re.sub(
        r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>',
        "",
        html_text,
        flags=re.IGNORECASE,
    )

    def _rewrite_anchor(match: re.Match[str]) -> str:
        prefix, href, suffix = match.group(1), match.group(2), match.group(3)
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:", "data:")):
            return match.group(0)
        abs_url = urllib.parse.urljoin(final_url, href)
        proxied = "/proxy?url=" + urllib.parse.quote(abs_url, safe="")
        return f'{prefix}{proxied}{suffix}'

    html_text = re.sub(
        r'(<a[^>]+href=["\'])([^"\']+)(["\'])',
        _rewrite_anchor,
        html_text,
        flags=re.IGNORECASE,
    )

    def _rewrite_form(match: re.Match[str]) -> str:
        prefix, action, suffix = match.group(1), match.group(2), match.group(3)
        if not action or action.startswith(("javascript:", "data:")):
            return match.group(0)
        abs_url = urllib.parse.urljoin(final_url, action)
        proxied = "/proxy?url=" + urllib.parse.quote(abs_url, safe="")
        return f'{prefix}{proxied}{suffix}'

    html_text = re.sub(
        r'(<form[^>]+action=["\'])([^"\']+)(["\'])',
        _rewrite_form,
        html_text,
        flags=re.IGNORECASE,
    )

    return html_text


class ProxyHandler(SimpleHTTPRequestHandler):
    server_version = "GazeTrackerProxy/1.0"

    def do_GET(self) -> None:  # noqa: N802 (HTTP method name)
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/proxy":
            self.handle_proxy_request(parsed)
            return
        super().do_GET()

    def handle_proxy_request(self, parsed_path: urllib.parse.ParseResult) -> None:
        query = urllib.parse.parse_qs(parsed_path.query)
        raw_url = query.get("url", [""])[0]

        try:
            target_url = ensure_http_url(raw_url)
        except ValueError as error:
            self.send_error(HTTPStatus.BAD_REQUEST, str(error))
            return

        req = urllib.request.Request(
            target_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;q=0.9,"
                    "*/*;q=0.8"
                ),
                "Referer": target_url,
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as upstream:
                final_url = upstream.geturl()
                status = upstream.status
                body = upstream.read()
                content_type = upstream.headers.get("Content-Type", "")

                is_html = "text/html" in content_type.lower()
                if is_html:
                    charset = "utf-8"
                    charset_match = re.search(
                        r"charset=([A-Za-z0-9_\-]+)", content_type, flags=re.IGNORECASE
                    )
                    if charset_match:
                        charset = charset_match.group(1)
                    decoded = body.decode(charset, errors="replace")
                    rewritten = rewrite_html_for_proxy(decoded, final_url)
                    body = rewritten.encode("utf-8")
                    content_type = "text/html; charset=utf-8"

                self.send_response(status)
                self.send_header("Content-Type", content_type or "application/octet-stream")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Frame-Options", "SAMEORIGIN")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("X-Proxy-Final-Url", final_url)
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as error:
            self.send_response(error.code)
            self.send_header(
                "Content-Type", error.headers.get("Content-Type", "text/plain; charset=utf-8")
            )
            for key, value in error.headers.items():
                lower_key = key.lower()
                if lower_key in HOP_BY_HOP_HEADERS or lower_key in {
                    "content-length",
                    "x-frame-options",
                    "content-security-policy",
                    "frame-ancestors",
                }:
                    continue
                self.send_header(key, value)
            data = error.read()
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as error:  # noqa: BLE001
            message = f"Proxy error: {error}"
            data = message.encode("utf-8", errors="replace")
            self.send_response(HTTPStatus.BAD_GATEWAY)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)


class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> None:
    parser = argparse.ArgumentParser(description="Local gaze tracker proxy server.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host. Default: 127.0.0.1")
    parser.add_argument("--port", type=int, default=5500, help="Bind port. Default: 5500")
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), ProxyHandler)
    print(f"Serving at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
