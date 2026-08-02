// posted_log.json 읽기/쓰기 — 최근 게시 상품·카테고리 이력 관리.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, '..', 'data', 'posted_log.json');

const DAY_MS = 24 * 60 * 60 * 1000;

/** @returns {Array<{productId:number|string, productName:string, category:string, postedAt:string}>} */
export function readLog() {
  if (!existsSync(LOG_PATH)) return [];
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return [];
  }
}

export function writeLog(entries) {
  writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2) + '\n', 'utf8');
}

/** 최근 N시간 내에 게시한 적 있는지 (중복 게시 방지 가드) */
export function postedRecently(hours = 20, now = Date.now()) {
  const log = readLog();
  if (!log.length) return false;
  const latest = Math.max(...log.map((e) => new Date(e.postedAt).getTime()));
  return now - latest < hours * 60 * 60 * 1000;
}

/** 최근 N일 내에 게시된 상품 ID Set */
export function recentProductIds(days = 30, now = Date.now()) {
  const cutoff = now - days * DAY_MS;
  const ids = new Set();
  for (const e of readLog()) {
    if (new Date(e.postedAt).getTime() >= cutoff) ids.add(String(e.productId));
  }
  return ids;
}

/** 최근 게시글의 카테고리 tier 비율 (편중 방지 판단용) */
export function recentTierCounts(count = 10) {
  const log = readLog().slice(-count);
  let high = 0;
  let low = 0;
  for (const e of log) {
    if (e.tier === 'low') low++;
    else high++;
  }
  return { high, low, total: log.length };
}

/** 게시 완료된 상품들을 로그에 추가 */
export function appendPosted(products, category, postedAt = new Date().toISOString()) {
  const log = readLog();
  for (const p of products) {
    log.push({
      productId: p.productId,
      productName: p.productName,
      category: category.name,
      tier: category.tier,
      postedAt,
    });
  }
  writeLog(log);
  return log;
}
