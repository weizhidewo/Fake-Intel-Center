import subprocess
import os
import json

PROXY_ENV = os.environ.copy()
PROXY_ENV['HTTP_PROXY'] = 'http://127.0.0.1:1081'
PROXY_ENV['HTTPS_PROXY'] = 'http://127.0.0.1:1081'
if 'RUBYOPT' in PROXY_ENV:
    del PROXY_ENV['RUBYOPT']

url = "http://example.com"
cmd = ['whatweb', '--log-json', '-', url]
result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=PROXY_ENV)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("RETURNCODE:", result.returncode)
if result.stdout:
    try:
        first_line = result.stdout.strip().split('\n')[0]
        data = json.loads(first_line)
        print("PARSED:", json.dumps(data, indent=2))
    except Exception as e:
        print("JSON parse error:", e)
