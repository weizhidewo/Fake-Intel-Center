import subprocess
import os

PROXY_ENV = os.environ.copy()
PROXY_ENV['HTTP_PROXY'] = 'http://127.0.0.1:1081'
PROXY_ENV['HTTPS_PROXY'] = 'http://127.0.0.1:1081'

target = "www.nnnu.edu.cn"
scheme = "https"
url = f"{scheme}://{target}"

cmd = ['curl', '-s', '-I', '-L', '--max-time', '30', '-x', 'http://127.0.0.1:1081', url]
result = subprocess.run(cmd, capture_output=True, text=True, timeout=35, env=PROXY_ENV)

print("=== 原始 stdout ===")
print(repr(result.stdout))
print("\n=== 原始 stdout 可见字符 ===")
print(result.stdout)
print("\n=== 返回码 ===", result.returncode)

headers = {}
lines = result.stdout.split('\n')
print("\n=== 按行解析（未处理） ===")
for i, line in enumerate(lines):
    print(f"{i}: {repr(line)}")
    if ':' in line and not line.startswith('HTTP/'):
        k, v = line.split(':', 1)
        headers[k.strip()] = v.strip()

print("\n=== 解析出的 headers ===")
print(headers)
