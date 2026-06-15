import subprocess
import os

PROXY_ENV = os.environ.copy()
PROXY_ENV['HTTP_PROXY'] = 'http://127.0.0.1:1081'
PROXY_ENV['HTTPS_PROXY'] = 'http://127.0.0.1:1081'

target = "www.nnnu.edu.cn"
scheme = "https"
url = f"{scheme}://{target}"

cmd = ['curl', '-s', '-I', '-L', '--max-time', '30', '-x', 'http://127.0.0.1:1081', url]
print("命令:", " ".join(cmd))
result = subprocess.run(cmd, capture_output=True, text=True, timeout=35, env=PROXY_ENV)

print("返回码:", result.returncode)
print("=== stdout 原始 repr ===")
print(repr(result.stdout))
print("=== stdout 按行 ===")
lines = result.stdout.split('\n')
for i, line in enumerate(lines):
    print(f"{i}: {repr(line)}")

headers = {}
for line in lines:
    line = line.strip()
    if not line or line.startswith('HTTP/'):
        continue
    if ':' in line:
        k, v = line.split(':', 1)
        headers[k.strip()] = v.strip()

print("=== 解析出的 headers ===")
print(headers)
