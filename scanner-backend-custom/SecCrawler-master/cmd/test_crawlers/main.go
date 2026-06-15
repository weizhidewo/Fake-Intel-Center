package main

import (
    "SecCrawler/bot"
    "SecCrawler/config"
    "SecCrawler/crawler"
    "SecCrawler/register"
    "fmt"
    "time"
)

func main() {
    // 初始化配置（必须）
    config.ConfigInit()
    // 初始化机器人（虽然用不到，但某些爬虫初始化可能需要）
    bot.BotInit()
    // 注册爬虫
    crawler.CrawlerInit()

    fmt.Println("\n========== SecCrawler 爬虫全量测试（忽略时间限制） ==========\n")

    // 遍历所有已注册的爬虫
    for name, cr := range register.GetCrawlerMap() {
        fmt.Printf("[▶] 测试爬虫: %s\n", name)
        start := time.Now()
        result, err := cr.Get()
        elapsed := time.Since(start)

        if err != nil {
            fmt.Printf("    ✗ 错误: %v\n", err)
        } else {
            fmt.Printf("    ✓ 成功，抓取到 %d 篇文章 (耗时 %v)\n", len(result), elapsed)
            if len(result) > 0 {
                fmt.Println("    最新5篇文章:")
                maxShow := 5
                if len(result) < maxShow {
                    maxShow = len(result)
                }
                for i := 0; i < maxShow; i++ {
                    link := result[i][0]
                    title := result[i][1]
                    fmt.Printf("      [%d] %s\n          %s\n", i+1, title, link)
                }
            } else {
                fmt.Println("    未抓取到任何文章")
            }
        }
        fmt.Println()
    }

    fmt.Println("========== 测试完成 ==========")
}
