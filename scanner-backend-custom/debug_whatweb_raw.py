import subprocess
import os
import json

# 完全按照后端的环境设置
PROXY_ENV = os.environ.copy()
PROXY_ENV['HTTP_PROXY'] = 'http://127.0.0.1:1081'
PROXY_ENV['HTTPS_PROXY'] = 'http://127.0.0.1:1081'
if 'RUBYOPT' in PROXY_ENV:
    del PROXY_ENV['RUBYOPT']
PROXY_ENV['SSL_CERT_FILE'] = '/dev/null'

url = "http://example.com"
cmd = ['whatweb', '--log-json', '-', url]

print("=== 执行命令 ===")
print(" ".join(cmd))
print("=== 环境变量 ===")
for k in ['HTTP_PROXY', 'HTTPS_PROXY', 'SSL_CERT_FILE', 'RUBYOPT']:
    print(f"{k}={PROXY_ENV.get(k)}")

result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=PROXY_ENV)

print("\n=== 返回码 ===")
print(result.returncode)

print("\n=== STDOUT (原始) ===")
print(repr(result.stdout))
print("\n=== STDOUT (前500字符) ===")
print(result.stdout[:500])

print("\n=== STDERR (原始) ===")
print(repr(result.stderr))

# 尝试解析
if result.stdout:
    lines = result.stdout.strip().split('\n')
    print(f"\n=== 总行数: {len(lines)} ===")
    for i, line in enumerate(lines[:3]):
        print(f"行{i}: {repr(line[:200])}")
    try:
        # 尝试第一行
        first_line = lines[0]
        data = json.loads(first_line)
        print("\n✅ 第一行解析成功，是 JSON 对象")
        print("headers字段:", data.get('headers', {}))
    except Exception as e:
        print(f"\n❌ 第一行解析失败: {e}")
        # 尝试整体解析
        try:
            data = json.loads(result.stdout)
            print("\n✅ 整体解析成功")
        except Exception as e2:
            print(f"❌ 整体解析也失败: {e2}")
else:
    print("\n❌ stdout 为空")
