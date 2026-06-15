import os
import subprocess
import json
import hmac
import re
import ssl
import socket
from urllib.parse import urlparse
from flask import Flask, request, jsonify
from flask_cors import CORS
import dns.resolver
import whois
import requests

app = Flask(__name__)
CORS(app)

SCANNER_KEY = "my-fixed-scanner-key-32-bytes-long"
PORT = 8080

def verify_auth(request):
    auth_header = request.headers.get('Authorization', '')
    api_key = request.headers.get('X-API-Key', '')
    token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else api_key
    if token and hmac.compare_digest(token, SCANNER_KEY):
        return True
    key_param = request.args.get('key')
    if key_param and hmac.compare_digest(key_param, SCANNER_KEY):
        return True
    return False

@app.before_request
def check_auth():
    if request.method == 'OPTIONS':
        return
    if not verify_auth(request):
        return jsonify({'error': 'Unauthorized'}), 401

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

# ==================== 端口扫描 ====================
@app.route('/api/scan/ports', methods=['GET'])
def scan_ports():
    target = request.args.get('target')
    ports = request.args.get('ports', '1-1000')
    if not target:
        return jsonify({'error': 'target required'}), 400
    cmd = ['nmap', '-p', ports, '--open', '-oX', '-', '-sT', target]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0 and result.returncode != 1:
            return jsonify({'error': result.stderr}), 500
        import xml.etree.ElementTree as ET
        root = ET.fromstring(result.stdout)
        ports_found = []
        for port in root.findall('.//port'):
            port_id = port.get('portid')
            state = port.find('state').get('state')
            if state == 'open':
                service = port.find('service')
                service_name = service.get('name') if service is not None else 'unknown'
                ports_found.append({'port': int(port_id), 'service': service_name, 'state': state})
        return jsonify({'target': target, 'ports': ports_found, 'scan_type': 'connect'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/scan/quick', methods=['GET'])
def scan_quick():
    return scan_ports()

# ==================== HTTP 头 ====================
@app.route('/scan/headers', methods=['GET'])
def scan_headers():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    if not target.startswith(('http://', 'https://')):
        target = 'https://' + target
    try:
        cmd = ['curl', '-s', '-I', '-L', '--max-time', '15', target]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        headers = {}
        for line in result.stdout.split('\n'):
            if ': ' in line:
                key, val = line.split(': ', 1)
                headers[key] = val.strip()
        return jsonify({'target': target, 'headers': headers})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== SSL/TLS 证书 ====================
@app.route('/scan/ssl', methods=['GET'])
def scan_ssl():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    host = target.split(':')[0] if ':' not in target else target.split(':')[0]
    port = 443
    if ':' in target:
        try:
            port = int(target.split(':')[1])
        except:
            port = 443
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                issuer = dict(x[0] for x in cert['issuer']) if isinstance(cert['issuer'], tuple) else {}
                subject = dict(x[0] for x in cert['subject']) if isinstance(cert['subject'], tuple) else {}
                result = {
                    'subject': subject.get('commonName', ''),
                    'issuer': issuer.get('commonName', ''),
                    'expiry': cert.get('notAfter', ''),
                    'serial': cert.get('serialNumber', '')
                }
                return jsonify({'target': target, 'ssl': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== 子域名枚举 ====================
@app.route('/scan/subdomains', methods=['GET'])
def scan_subdomains():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    common = ['www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'webdisk', 'ns2',
              'cpanel', 'whm', 'autodiscover', 'autoconfig', 'm', 'imap', 'test', 'ns', 'blog', 'pop3',
              'dev', 'www2', 'admin', 'forum', 'news', 'vpn', 'ns3', 'mail2', 'new', 'mysql', 'old',
              'lists', 'support', 'mobile', 'mx', 'static', 'docs', 'beta', 'shop', 'sql', 'secure',
              'demo', 'cp', 'calendar', 'wiki', 'web', 'media', 'email', 'images', 'img', 'www1',
              'intranet', 'portal', 'video', 'sip', 'dns2', 'api', 'cdn', 'stats', 'dns1', 'ns4']
    found = []
    for sub in common:
        domain = f"{sub}.{target}"
        try:
            result = subprocess.run(['dig', '+short', domain], capture_output=True, text=True, timeout=5)
            if result.returncode == 0 and result.stdout.strip():
                found.append({'domain': domain, 'ip': result.stdout.strip().split('\n')[0]})
        except:
            continue
    return jsonify({'target': target, 'subdomains': found})

# ==================== 技术栈检测 ====================
@app.route('/scan/tech', methods=['GET'])
def scan_tech():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    if not target.startswith(('http://', 'https://')):
        target = 'https://' + target
    tech = []
    try:
        cmd = ['curl', '-s', '-L', '--max-time', '10', target]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        html = result.stdout
        if re.search(r'wordpress', html, re.I): tech.append('WordPress')
        if re.search(r'jquery', html, re.I): tech.append('jQuery')
        if re.search(r'bootstrap', html, re.I): tech.append('Bootstrap')
        if re.search(r'react', html, re.I): tech.append('React')
        if re.search(r'vue', html, re.I): tech.append('Vue.js')
        if re.search(r'nginx', html, re.I): tech.append('Nginx')
        if re.search(r'apache', html, re.I): tech.append('Apache')
        if re.search(r'cloudflare', html, re.I): tech.append('CloudFlare')
        return jsonify({'target': target, 'technologies': tech})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== DNS 查询 ====================
@app.route('/scan/dns', methods=['GET'])
def scan_dns():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    records = {}
    for qtype in ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME']:
        try:
            answers = dns.resolver.resolve(target, qtype)
            records[qtype] = [str(r) for r in answers]
        except:
            records[qtype] = []
    return jsonify({'domain': target, 'records': records})

# ==================== WHOIS 查询 ====================
@app.route('/scan/whois', methods=['GET'])
def scan_whois():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    try:
        w = whois.whois(target)
        result = {}
        for k, v in w.items():
            if v:
                result[k] = str(v)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== BGP 查询（使用 bgpview.io） ====================
@app.route('/scan/bgp', methods=['GET'])
def scan_bgp():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    try:
        if target.startswith('AS') or target.isdigit():
            asn = target.replace('AS', '')
            url = f'https://api.bgpview.io/asn/{asn}'
        else:
            url = f'https://api.bgpview.io/ip/{target}'
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return jsonify(resp.json())
        else:
            return jsonify({'error': f'BGP API returned {resp.status_code}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== 威胁情报（VirusTotal） ====================
@app.route('/scan/threats', methods=['GET'])
def scan_threats():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    vt_key = os.environ.get('VT_API_KEY', '')
    if not vt_key:
        return jsonify({'error': '威胁情报需要配置 VirusTotal API Key (环境变量 VT_API_KEY)'}), 501
    try:
        url = f'https://www.virustotal.com/api/v3/domains/{target}'
        headers = {'x-apikey': vt_key}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            stats = data.get('data', {}).get('attributes', {}).get('last_analysis_stats', {})
            return jsonify({'target': target, 'stats': stats})
        else:
            return jsonify({'error': f'VT API 返回 {resp.status_code}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== SNMP 深度扫描（需要 nmap） ====================
@app.route('/scan/snmp', methods=['GET'])
def scan_snmp():
    target = request.args.get('target')
    if not target:
        return jsonify({'error': 'target required'}), 400
    try:
        cmd = ['nmap', '-sU', '-p', '161', '--script', 'snmp-brute', target]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return jsonify({'target': target, 'output': result.stdout})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== 深度扫描（别名，复用端口扫描） ====================
@app.route('/scan/deep', methods=['GET'])
def scan_deep():
    return scan_ports()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT)
