// 링크 페이지 아카이브 — 과거 게시 상품도 프로필 링크에서 구매 가능하도록 누적 관리.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = join(__dirname, '..', 'data', 'link-archive.json');

const MAX_ENTRIES = 21; // 최근 약 3주치 유지

/** @returns {Array<{date:string, category:string, products:Array}>} */
export function readArchive() {
  if (!existsSync(PATH)) return [];
  try {
    return JSON.parse(readFileSync(PATH, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * 오늘 게시분을 아카이브 맨 앞에 추가(같은 날짜는 교체) 후 저장.
 * @param {{date:string, category:string, products:Array}} entry
 * @returns {Array} 갱신된 아카이브
 */
export function addEntry(entry) {
  const archive = readArchive().filter((e) => e.date !== entry.date);
  archive.unshift(entry);
  const trimmed = archive.slice(0, MAX_ENTRIES);
  writeFileSync(PATH, JSON.stringify(trimmed, null, 2) + '\n', 'utf8');
  return trimmed;
}
