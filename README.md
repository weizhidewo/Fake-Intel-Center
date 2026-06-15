<img width="552" height="937" alt="image" src="https://github.com/user-attachments/assets/f86d197f-1278-43a9-a4a7-8843909bb3ef" /><img width="552" height="937" alt="image" src="https://github.com/user-attachments/assets/ea57b695-56b7-4ac1-aab3-d988cb7f898d" /><img width="586" height="911" alt="8_TZSW C4X8ZPN}8)7JEMJ9" src="https://github.com/user-attachments/assets/61bc70b9-2c67-4ce8-9f18-18e74caae4e1" />本项目基于osiris开发，若遇见bug欢迎反馈，正在找寻能接入漏扫的好项目或其他功能，若有好的web扫描器与MCP网关后端或开源前端，欢迎联系qq：1824675740，本项目较原项目主要添加部分功能与通用代理设置以及数据对齐，方便爬取使用并扩充部分数据来源

###核心开发点
1.补齐原项目缺少的部分侦察包工具（如端口扫描、HTTP头探测、SSL/TSL查询、子域名枚举、技术栈探测，并聚合在工具包下的app.py内，如有需要请自行查看所用工具并安装使用，响应请勿修改，若需修改前端接收的响应也需做出对应修改）

2.添加漏洞与安全情报检测模块，并利用AI对文本进行简单处理显示与前端（根据时间排序，若有需求可自己在设置修改获取数据量与爬取间隔）
<img width="567" height="938" alt="9$ $KX}W`980`~R%J% ZA(M" src="https://github.com/user-attachments/assets/3cabc8ea-9c36-4094-ad9d-4b4d5cb0039d" />

3.添加AI分析功能，调用项目内API传输数据至文本预处理模型进行核心内容处理（推荐使用免费小模型），小模型处理完毕后推送至推理模型分析全球局势并生成对应卡片（最后一条已固定为各领域短中期发展预测）
<img width="596" height="950" alt=") {4IK(LU6LQ`M@SJA1$TF1" src="https://github.com/user-attachments/assets/7c3add89-2bbd-4851-95ce-fc99eb544ee7" />

<img width="552" height="937" alt="2OGXG_JA9~NJUG$VWHCA$PK" src="https://github.com/user-attachments/assets/04734fc6-46c0-4c25-938f-ef9ed914c656" />



4.添加了一些数据来源为数据分析做充足准备

### 核心能力

| 领域 | 数据点 | 数据源 |
|------|--------|--------|
| **航空** | 商用、私人、军用、喷气机 | OpenSky Network |
| **海事** | 39个全球港口，10个咽喉要道 | 静态海军情报 |
| **CCTV** | 以千为单位的摄像头 | TfL, WSDOT, Caltrans, NYC DOT, VicRoads 等 |
| **地震** | 实时M2.5级以上 | USGS Earthquake API |
| **火灾** | 活跃火点 | NASA FIRMS |
| **新闻** | 多个直播流 | 25+ 全球广播商 |
| **天气** | 极端天气事件 | NASA EONET |
| **空间** | 太阳活动、卫星 | NOAA SWPC, N2YO |
| **网络** | CVE威胁、漏洞扫描 | NVD, 自定义扫描器，OTX |
| **冲突** | 13个活跃区域 | 静态OSINT情报 |
| **加密货币** | BTC + ETH 钱包追踪、OFAC SDN匹配 | blockstream.info, Blockscout, OpenSanctions |
| **Telegram OSINT** | 公开频道的地理标记帖子 | 
| **🤖 AI 智能分析** | 基于多模型的情报推理与报告生成 | 可配置多套LLM（推理、预处理、安全情报专用） |
| **🔍 漏洞情报** | 实时CVE漏洞聚合、影响分析 | NVD、自定义扫描器（预留接口，可直接查找对应项目二开部署）、安全情报数据库 |
| **🛠️ 侦察工具包** | 端口扫描、DNS查询、WHOIS、SSL证书分析、IP情报、加密货币追踪、制裁检查 | 内置 + 外部API（漏洞扫描待完善） |

## 功能特性

 情报图层
16个可切换数据图层**，实时显示实体数量
GPU加速渲染** — 所有地图数据通过WebGL渲染，不使用DOM
渐进式加载** — 仅在图层激活时按需获取数据
视口感知** — 仅加载可见区域的相关数据

 🤖 AI 智能分析
多模型支持** — 可配置通用模型、推理模型、预处理模型、安全情报专用模型
智能上下文压缩** — 自动分块处理海量情报数据，支持64KB单块大小，大幅降低API调用频率
结构化情报卡片** — 输出包含新闻、金融市场、网络威胁、地震/灾害、海事/供应链等领域的卡片，最后附带风险趋势预测表格
分析历史** — 保存所有分析记录，支持回溯查看
定时分析** — 可设置自动分析间隔（小时）和数据源选择
自定义提示词** — 用户可输入自定义分析需求
兼容多种LLM API** — 支持OpenAI兼容接口（如DeepSeek、智谱GLM等）

 🔍 漏洞情报
实时CVE聚合** — 从NVD获取最新漏洞信息，支持按风险评分、发布时间筛选
安全情报数据库** — 内置SQLite数据库存储漏洞和情报数据
风险评分** — 自动评估漏洞严重性（CVSS）
情报分类** — 按领域分类（网络、物理、供应链等）
与地图联动** — 可根据漏洞来源地理位置标注（部分支持）

 🛠️ 侦察工具包（除漏洞扫描外与信息泄露其余已完成）
端口扫描** — TCP连接扫描，含服务指纹识别
DNS查询** — 完整记录解析（A, AAAA, MX, NS, TXT, CNAME）
WHOIS** — 域名/IP注册数据（自动与OFAC SDN交叉检查）
SSL/TLS检查器** — 证书链分析
IP情报** — 地理位置、ASN、威胁信誉（自动与OFAC SDN交叉检查）
加密货币钱包追踪** — BTC + ETH查询（余额、交易历史、OFAC SDN制裁标记）
OFAC制裁搜索** — 针对美国OFAC SDN名单查询个人、组织、船舶和飞机
漏洞扫描** — 基础实现，待完善（后续版本增强）

 直播广播网络
25+ 全球24/7新闻直播流**
- 点击地图上的新闻点即可打开直播
- 涵盖NBC、CBS、ABC、Sky News、Al Jazeera、France 24、NHK、WION等频道

 Telegram OSINT图层
公开频道信息流** — 从无需认证的 `t.me/s/<channel>` 网页预览抓取
- 默认预置5个精选频道（英文 + 俄乌战争报道），可通过环境变量覆盖
- 帖子通过多语言地名字典进行地理解析并标注
- 点击圆点即可阅读帖子并跳转到Telegram原文

 加密货币钱包情报
BTC** 通过 [blockstream.info](https://blockstream.info) 查询（无需密钥）
ETH** 通过 [Blockscout](https://blockscout.com) 公共实例查询

 冲突区域监控
13个活跃冲突/紧张区域**，带严重程度编码的警告标记
- 活跃战争：乌克兰、加沙、苏丹、缅甸、刚果（金）、也门
- 高度紧张：叙利亚、黎巴嫩、萨赫勒、索马里、红海
- 升级风险：台湾海峡、朝鲜半岛非军事区

 性能优化
- 激进的轮询放松策略（稳定数据15-30分钟间隔）
- 静态数据从内存提供服务（新闻源零外部API调用）
- `layerFetchedRef` 防止重复API请求

使用技术：
框架	Next.js 16（App Router, Turbopack）
语言	TypeScript 5
地图引擎	MapLibre GL JS（WebGL）
AI集成	多LLM支持（OpenAI兼容接口）
数据库	SQLite（漏洞情报）
