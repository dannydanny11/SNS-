// 주간 상품 풀 관리 — 새 자동화 구조의 핵심.
//   · 월요일마다 상품 10개 풀 확정(다양성) → 평일 오전8시/저녁7시 단품 릴스 10슬롯으로 소진
//   · 금요일 밤 캐러셀 5개(풀에서 재구성) → 링크는 프로필 허브 페이지
//   · 슬롯 기준 게시: "예정시각 지났고 아직 안 올린 슬롯"만 게시 → GitHub 크론 지연에 내성
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = join(__dirname, '..', 'data', 'week-pool.json');

const KST = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export const REEL_SLOTS = 10; // 평일 5일 × 하루 2개
const AM_HOUR = 8; // 오전 릴스 08:00 KST
const PM_HOUR = 19; // 저녁 릴스 19:00 KST
const CAROUSEL_DAY = 4; // 금요일(0=월)
const CAROUSEL_HOUR = 20; // 금 20:00 KST (저녁 릴스 뒤)
const DOW_KR = ['월', '화', '수', '목', '금', '토', '일'];

function kstParts(t) {
  const d = new Date(t + KST);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dow: d.getUTCDay(), // 0=일..6=토
    h: d.getUTCHours(),
  };
}
function pad(n) {
  return String(n).padStart(2, '0');
}

/** 해당 시각이 속한 주의 '월요일 KST 날짜'(YYYY-MM-DD) — 주 식별키 */
export function weekKeyOf(now = Date.now()) {
  const p = kstParts(now);
  const daysSinceMon = (p.dow + 6) % 7; // 월=0
  const kstMidnight = Date.UTC(p.y, p.m - 1, p.day) - KST; // 오늘 KST 00:00 의 UTC 순간
  const monday = new Date(kstMidnight - daysSinceMon * DAY + KST);
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}

/** weekKey(월요일 날짜)의 월요일 00:00 KST 를 나타내는 UTC 순간 */
function mondayInstant(weekKey) {
  const [Y, M, D] = weekKey.split('-').map(Number);
  return Date.UTC(Y, M - 1, D) - KST;
}

/** 릴스 슬롯(0~9)의 예정 시각(UTC 순간) */
export function slotInstant(weekKey, slot) {
  const dayIdx = Math.floor(slot / 2);
  const hour = slot % 2 === 0 ? AM_HOUR : PM_HOUR;
  return mondayInstant(weekKey) + dayIdx * DAY + hour * 3600 * 1000;
}

/** 캐러셀 예정 시각(UTC 순간) */
export function carouselInstant(weekKey) {
  return mondayInstant(weekKey) + CAROUSEL_DAY * DAY + CAROUSEL_HOUR * 3600 * 1000;
}

/** 슬롯 라벨(예: "월 오전") */
export function slotLabel(slot) {
  const dayIdx = Math.floor(slot / 2);
  return `${DOW_KR[dayIdx]} ${slot % 2 === 0 ? '오전' : '저녁'}`;
}

/** 초기 스케줄(10개 릴스 슬롯) 생성 */
export function buildSchedule() {
  return Array.from({ length: REEL_SLOTS }, (_, slot) => ({
    slot,
    label: slotLabel(slot),
    productIdx: slot, // 상품 1개당 릴스 1개 (순서대로)
    posted: false,
    reelId: null,
    postedAt: null,
  }));
}

export function readPool() {
  if (!existsSync(PATH)) return null;
  try {
    return JSON.parse(readFileSync(PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function savePool(pool) {
  writeFileSync(PATH, JSON.stringify(pool, null, 2) + '\n', 'utf8');
  return pool;
}

/** 이 풀이 현재 주(now 기준)의 것인가 */
export function isCurrentWeek(pool, now = Date.now()) {
  return !!pool && pool.weekKey === weekKeyOf(now);
}

/**
 * 지금 게시해야 할 릴스 슬롯 목록 — 예정시각이 지났고 아직 안 올린 것.
 * 지연 누락 대비 최대 cap개(기본 2)까지 따라잡기.
 */
export function dueReelSlots(pool, now = Date.now(), cap = 2) {
  if (!pool) return [];
  return pool.reels
    .filter((r) => !r.posted && slotInstant(pool.weekKey, r.slot) <= now)
    .sort((a, b) => a.slot - b.slot)
    .slice(0, cap);
}

/** 다음 올릴 릴스 슬롯 — 예정시각 무관, 가장 이른 미게시(건너뛴 것 제외) 1개 */
export function nextUnpostedReel(pool) {
  if (!pool) return null;
  return pool.reels
    .filter((r) => !r.posted && !r.skipped)
    .sort((a, b) => a.slot - b.slot)[0] || null;
}

/** 캐러셀을 지금 올려야 하는가 (금 20시 지남 + 미게시) */
export function carouselDue(pool, now = Date.now()) {
  if (!pool || !pool.carousel || pool.carousel.posted) return false;
  return carouselInstant(pool.weekKey) <= now;
}

/**
 * 캐러셀에 넣을 상품 5개 인덱스 선정 (지금은 간단 규칙: 상품 점수 상위).
 * (다음 단계: 릴스 실제 조회수 인사이트로 상위 5개)
 */
export function pickCarousel(pool, count = 5) {
  const scored = pool.products.map((p, idx) => ({ idx, score: p._score ?? 0, price: p.productPrice }));
  scored.sort((a, b) => b.score - a.score || a.price - b.price);
  return scored.slice(0, count).map((s) => s.idx).sort((a, b) => a - b);
}

/**
 * 주 중간에 시작할 때 — '오늘(KST) 이전' 날짜의 릴스 슬롯은 건너뜀(skipped) 처리.
 * (월요일 08시 정상 생성 시엔 지난 슬롯이 없어 아무것도 건너뛰지 않음)
 */
export function skipPastSlots(pool, now = Date.now()) {
  const p = kstParts(now);
  const todayMidnight = Date.UTC(p.y, p.m - 1, p.day) - KST; // 오늘 KST 00:00
  for (const r of pool.reels) {
    if (!r.posted && slotInstant(pool.weekKey, r.slot) < todayMidnight) {
      r.posted = true;
      r.skipped = true;
    }
  }
  return pool;
}

export function markReelPosted(pool, slot, reelId, now = Date.now()) {
  const r = pool.reels.find((x) => x.slot === slot);
  if (r) {
    r.posted = true;
    r.reelId = reelId || null;
    r.postedAt = new Date(now).toISOString();
  }
  return pool;
}

export function markCarouselPosted(pool, postId, now = Date.now()) {
  pool.carousel.posted = true;
  pool.carousel.postId = postId || null;
  pool.carousel.postedAt = new Date(now).toISOString();
  return pool;
}
