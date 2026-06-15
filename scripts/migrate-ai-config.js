const fs = require('fs');
const path = require('path');

const oldConfigPath = '/home/osiris-master/scanner-backend-custom/llm_config.json';
const newConfigPath = '/home/osiris-master/data/ai_providers.json';

// 确保目录存在
if (!fs.existsSync(path.dirname(newConfigPath))) {
  fs.mkdirSync(path.dirname(newConfigPath), { recursive: true });
}

let providers = [];

if (fs.existsSync(oldConfigPath)) {
  const oldConfig = JSON.parse(fs.readFileSync(oldConfigPath, 'utf-8'));
  // 将旧配置作为默认的 analyzer
  providers.push({
    id: 'analyzer_1',
    name: '主分析引擎（原配置）',
    role: 'analyzer',
    apiUrl: oldConfig.apiUrl || '',
    apiKey: oldConfig.apiKey || '',
    model: oldConfig.model || 'deepseek-ai/DeepSeek-V3',
    enabled: true
  });
  // 创建一个预处理器占位（需用户手动填写）
  providers.push({
    id: 'preprocessor_1',
    name: '预处理器（请配置）',
    role: 'preprocessor',
    apiUrl: '',
    apiKey: '',
    model: '',
    enabled: false
  });
} else {
  // 默认示例
  providers = [
    {
      id: 'preprocessor_1',
      name: '预处理模型（用于提取情报）',
      role: 'preprocessor',
      apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
      apiKey: '',
      model: 'Qwen/Qwen2.5-7B-Instruct',
      enabled: false
    },
    {
      id: 'analyzer_1',
      name: '主分析模型（用于推理）',
      role: 'analyzer',
      apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
      apiKey: '',
      model: 'deepseek-ai/DeepSeek-V3',
      enabled: true
    }
  ];
}

fs.writeFileSync(newConfigPath, JSON.stringify(providers, null, 2));
console.log('AI 配置已迁移到', newConfigPath);
