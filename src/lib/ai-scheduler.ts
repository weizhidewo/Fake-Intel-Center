import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

let currentTask: cron.ScheduledTask | null = null;

const SCHEDULE_FILE = path.join(process.cwd(), 'data', 'ai_schedule.json');
const getIntervalHours = (): number => {
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      const raw = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
      const config = JSON.parse(raw);
      return config.intervalHours || 9;
    }
  } catch {}
  return 9;
};

async function runScheduledAnalysis() {
  const url = `http://localhost:${process.env.PORT || 3000}/api/ai-analysis/run`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '定时任务：分析当前全球安全局势，包含地缘冲突、网络攻击、经济制裁等最新情报。' })
    });
    console.log(`[AI Scheduler] 定时分析执行完成 at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('[AI Scheduler] 定时分析失败:', error);
  }
}

export function initScheduler() {
  if (typeof window !== 'undefined') return; // 仅在服务端运行
  if (currentTask) currentTask.stop();
  const hours = getIntervalHours();
  // cron 表达式：0 */hours * * * (每 hours 小时的第 0 分钟执行)
  const cronExpression = `0 */${hours} * * *`;
  currentTask = cron.schedule(cronExpression, runScheduledAnalysis);
  console.log(`[AI Scheduler] 已启动，间隔 ${hours} 小时，cron: ${cronExpression}`);
}

export function reloadScheduler(newHours: number) {
  if (typeof window !== 'undefined') return;
  if (currentTask) currentTask.stop();
  const cronExpression = `0 */${newHours} * * *`;
  currentTask = cron.schedule(cronExpression, runScheduledAnalysis);
  console.log(`[AI Scheduler] 已重载，新间隔 ${newHours} 小时，cron: ${cronExpression}`);
}

// 挂载 reload 到全局，供 API 调用
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__aiSchedulerReload = reloadScheduler;
}
