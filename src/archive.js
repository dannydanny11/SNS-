// 링크 페이지 아카이브 — 과거 게시 상품도 프로필 링크에서 구매 가능하도록 누적 관리.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = join(__dirname, '..', 'data', 'link-archive.json');

const MAX_ENTRIES = 40; // 최근 게시 40건 유지 (지난 상품도 계속 구매 가능)

/** @returns {Array<{runId:string, date:string, category:string, products:Array}>} */
export function readArchive() {
  if (!existsSync(PATH)) return [];
  try {
    return JSON.parse(readFileSync(PATH, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * 게시 건(runId)마다 아카이브 맨 앞에 누적 추가 후 저장.
 * (날짜가 아니라 게시 건 기준 → 하루 여러 번 올려도 전부 쌓임)
 * @param {{runId:string, date:string, category:string, products:Array}} entry
 * @returns {Array} 갱신된 아카이브
 */
export function addEntry(entry) {
  const archive = readArchive().filter((e) => e.runId !== entry.runId);
  archive.unshift(entry);
  const trimmed = archive.slice(0, MAX_ENTRIES);
  writeFileSync(PATH, JSON.stringify(trimmed, null, 2) + '\n', 'utf8');
  return trimmed;
}
