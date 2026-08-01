// 게시 직전 검증 — 대가성 문구가 없는 게시물은 발행 자체를 차단한다.
import { DISCLOSURE } from './caption.js';

/**
 * 캡션이 발행 가능한지 검증.
 * @param {string} caption
 * @returns {{ok:boolean, reason?:string}}
 */
export function validateCaption(caption) {
  if (!caption || caption.trim().length === 0) {
    return { ok: false, reason: '캡션이 비어 있음' };
  }
  if (!caption.includes(DISCLOSURE)) {
    return { ok: false, reason: '대가성 문구 누락 — 발행 차단' };
  }
  const hashtagCount = (caption.match(/#[^\s#]+/g) || []).length;
  if (hashtagCount < 5) {
    return { ok: false, reason: `해시태그 부족(${hashtagCount}개)` };
  }
  return { ok: true };
}
