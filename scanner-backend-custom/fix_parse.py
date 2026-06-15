import re
with open('app.py', 'r') as f:
    content = f.read()

# 替换 scan_headers 中的解析部分
old_headers_parse = r'first_line = result\.stdout\.strip\(\)\.split\(.\\n.\)\[0\]'
new_headers_parse = '''lines = result.stdout.strip().split('\\n')
            if len(lines) < 2:
                return jsonify({'target': target, 'headers': {}, 'error': 'Unexpected whatweb output'})
            first_line = lines[1]'''
content = re.sub(old_headers_parse, new_headers_parse, content)

# 同样替换 scan_tech
content = re.sub(old_headers_parse, new_headers_parse, content)

with open('app.py', 'w') as f:
    f.write(content)
print("已修改解析逻辑，取第二行")
