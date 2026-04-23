from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
class Res(BaseHTTPRequestHandler):
    def do_GET(self):
        print("LOG:", urllib.parse.unquote(self.path))
        self.send_response(200)
        self.end_headers()
HTTPServer(('', 9000), Res).serve_forever()
