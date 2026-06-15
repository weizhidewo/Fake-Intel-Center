import subprocess
import os
import json

PROXY_ENV = os.environ.copy()
PROXY_ENV['HTTP_PROXY'] = 'http://127.0.0.1:1081'
PROXY_ENV['HTTPS_PROXY'] = 'http://127.0.0.1:1081'
if 'RUBYOPT' in PROXY_ENV:
    del PROXY_ENV['RUBYOPT']
PROXY_ENV['SSL_CERT_FILE'] = '/dev/null'

# 定义 whatweb 命令（带浏览器头）
base_cmd = [
    'whatweb',
    '--header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    '--header', 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
    '--log-json', '-'
]

def test_url(url):
    print(f"\n=== 测试 {url} ===")
    cmd = base_cmd + [url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=PROXY_ENV)
    print(f"返回码: {result.returncode}")
    print("完整 stdout:")
    print(result.stdout)
    if result.stdout:
        lines = result.stdout.strip().split('\n')
        if len(lines) >= 2:
            second_line = lines[1]
            print("\n第二行 JSON:")
            print(second_line)
            try:
                data = json.loads(second_line)
                print("\nJSON 顶层键:", list(data.keys()))
                if 'headers' in data:
                    print("headers 字段内容:", data['headers'])
                else:
                    print("没有 'headers' 字段")
                if 'request_config' in data:
                    print("request_config 中的 headers:", data['request_config'].get('headers', {}))
                if 'plugins' in data:
                    print("plugins 中的键:", list(data['plugins'].keys()))
            except Exception as e:
                print("JSON 解析错误:", e)
        else:
            print("输出行数不足2")

test_url("http://example.com")
test_url("https://www.nnnu.edu.cn")
