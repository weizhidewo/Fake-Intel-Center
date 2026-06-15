import subprocess
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
SCANNER_KEY = "my-fixed-scanner-key-32-bytes-long"

PROXY_ENV = os.environ.copy()
PROXY_ENV['HTTP_PROXY'] = 'http://127.0.0.1:1081'
PROXY_ENV['HTTPS_PROXY'] = 'http://127.0.0.1:1081'
if 'RUBYOPT' in PROXY_ENV:
    del PROXY_ENV['RUBYOPT']

def verify_auth(req):
    token = req.headers.get('Authorization', '').replace('Bearer ', '')
    return token == SCANNER_KEY

@app.before_request
def check_auth():
    if request.method == 'OPTIONS' or verify_auth(request):
        return
    return jsonify({'error': 'Unauthorized'}), 401

@app.route('/scan/headers', methods=['GET'])
def scan_headers():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    url = f"http://{target}"
    cmd = ['whatweb', '--log-json', '-', url]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=PROXY_ENV)
        return jsonify({
            'target': target,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
