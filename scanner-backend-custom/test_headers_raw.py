import subprocess
import os
import json

PROXY_ENV = os.environ.copy()
PROXY_ENV['HTTP_PROXY'] = 'http://127.0.0.1:1081'
PROXY_ENV['HTTPS_PROXY'] = 'http://127.0.0.1:1081'
if 'RUBYOPT' in PROXY_ENV:
    del PROXY_ENV['RUBYOPT']
PROXY_ENV['SSL_CERT_FILE'] = '/dev/null'

url = "https://www.nnnu.edu.cn"   # 替换为你要测试的网站
cmd = ['whatweb', '--log-json', '-', url]

result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=PROXY_ENV)
print("=== 返回码 ===", result.returncode)
print("=== 原始输出 ===")
print(result.stdout)
print("\n=== 按行解析 ===")
lines = result.stdout.strip().split('\n')
for i, line in enumerate(lines):
    print(f"行{i}: {line[:200]}")
    if i == 1:   # 第二行应该是 JSON 对象
        try:
            data = json.loads(line)
            print("   -> 解析成功，keys:", data.keys())
            if 'headers' in data:
                print("   -> headers 字段:", data['headers'])
            else:
                print("   -> 无 headers 字段")
        except Exception as e:
            print("   -> 解析失败:", e)
