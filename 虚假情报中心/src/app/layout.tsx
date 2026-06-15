import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://osirisai.live";
const SITE_NAME = "虚假情报中心";
const SITE_TITLE = "虚假情报中心 — 开源情报平台 | 实时航班追踪、监控摄像头、OSINT 工具等";
const SITE_DESCRIPTION = "开源的 Palantir 替代方案。在 3D 地球上实时追踪 10,000+ 架飞机、2,000 颗卫星和全球 CCTV 摄像头。从浏览器运行 Nmap 扫描、DNS 查询、WHOIS 查询、SSL 证书分析和威胁情报。20+ 实时数据源，包括地震、野火、核设施、网络威胁和全球冲突。免费且开源。";

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | 虚假情报中心",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    // OSINT 工具 - 主要焦点
    "OSINT 工具", "免费 OSINT 工具", "在线 OSINT 工具包", "OSINT 框架",
    "在线 Nmap", "在线 Nmap 扫描器", "免费 Nmap 扫描", "在线端口扫描器",
    "DNS 查询工具", "WHOIS 查询", "反向 DNS", "DNS 记录",
    "SSL 证书检查器", "证书透明度", "证书查询",
    "BGP 路由查询", "ASN 查询", "IP 地理位置",
    "威胁情报", "威胁情报查询", "IP 信誉检查",
    "网络侦察", "侦察工具", "渗透测试工具",
    "网络安全工具", "信息安全工具", "安全扫描器",
    "Linux OSINT 工具", "在线 Kali Linux 工具", "浏览器 OSINT 工具",
    
    // 情报平台
    "OSINT", "开源情报", "情报平台", "全球情报",
    "地理空间情报", "GEOINT", "SIGINT", "实时追踪",
    "Palantir 替代品", "开源 Palantir", "情报仪表板",
    
    // 追踪与数据
    "航班追踪", "飞机追踪", "ADS-B 追踪器", "实时航班雷达",
    "卫星追踪", "ISS 追踪器", "空间站追踪",
    "实时监控摄像头", "全球安全摄像头", "实时摄像头",
    "地震监测", "地震活动", "USGS 地震",
    "野火追踪", "NASA FIRMS", "活跃火点",
    "核设施地图", "核电站",
    "恶劣天气警报", "天气雷达",
    "网络威胁仪表板", "CVE 追踪器",
    "空间天气", "太阳风暴", "GPS 干扰",
    "军工股票", "大宗商品追踪",
    
    // 品牌
    "虚假情报中心", "虚假情报中心", "osirisai.live",
  ],
  authors: [{ name: "虚假情报中心项目", url: SITE_URL }],
  creator: "虚假情报中心项目",
  publisher: "虚假情报中心项目",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-touch-icon.png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "虚假情报中心 — 开源的 Palantir 替代方案 | 实时航班、监控摄像头、卫星与 OSINT 工具",
    description: "在 3D 地球上追踪 10K+ 飞机、2K 卫星和全球 CCTV。从浏览器运行 Nmap、DNS、WHOIS 和威胁情报扫描。20+ 实时情报数据源。免费。开源。",
    type: "website",
    siteName: SITE_NAME,
    locale: "zh_CN",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "虚假情报中心 — 开源情报平台，实时追踪与 OSINT 工具",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "🛰️ 虚假情报中心 — 开源的 Palantir 替代方案 | 实时追踪 + OSINT 工具",
    description: "追踪 10K+ 航班、卫星和全球 CCTV。从浏览器运行 Nmap、DNS、WHOIS 扫描。20+ 实时情报数据源。免费且开源。",
    creator: "@simplifaisoul",
    site: "@simplifaisoul",
    images: [`${SITE_URL}/og-image.png`],
  },
  category: "technology",
  classification: "情报与安全",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "虚假情报中心",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#06060C",
    "msapplication-config": "none",
  },
};

// JSON-LD 结构化数据
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "虚假情报中心 — OSINT 工具包与情报平台",
  alternateName: ["虚假情报中心", "OsirisAI", "虚假情报中心 OSINT"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  browserRequirements: "需要现代网络浏览器",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "从浏览器进行 Nmap 端口扫描 — 无需安装",
    "DNS 记录查询（A、AAAA、MX、NS、TXT、CNAME）",
    "WHOIS 域名注册信息查询",
    "SSL/TLS 证书透明度搜索",
    "BGP 路由与 ASN 查询",
    "IP 地理位置与威胁情报",
    "实时航班追踪（10,000+ 飞机，通过 ADS-B）",
    "卫星追踪（2,000+ 物体，包括国际空间站）",
    "全球 CCTV 监控摄像头监控（1,400+ 数据源）",
    "地震监测（USGS 实时数据）",
    "野火检测（NASA FIRMS 卫星数据）",
    "全球核设施地图",
    "恶劣天气警报与追踪",
    "网络威胁与 CVE 情报",
    "空间天气与太阳风暴监测",
    "GPS 干扰检测",
    "军工与大宗商品市场追踪",
    "SIGINT 新闻聚合信息流",
    "交互式 3D 地球仪，支持昼夜交替",
    "地区情报档案报告",
  ],
  screenshot: `${SITE_URL}/og-image.png`,
  author: {
    "@type": "Organization",
    name: "虚假情报中心项目",
    url: SITE_URL,
  },
};

import ErrorBoundary from '@/components/ErrorBoundary';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="canonical" href={SITE_URL} />
        
        {/* JSON-LD 结构化数据 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

      </head>
      <body className="antialiased">
        <ErrorBoundary name="虚假情报中心核心">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
