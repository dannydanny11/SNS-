// 세로 쇼츠 슬라이드 HTML (1080×1920). 자막(캡션)을 슬라이드에 직접 굽는다.
// 쇼츠 UI 안전영역: 하단 ~320px(버튼/진행바), 우측 ~140px 은 텍스트 회피.
import { THEMES } from '../cards/theme.js';

const W = 1080;
const H = 1920;

function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : n;
}
function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function cleanName(name = '') {
  return esc(name.split(',')[0].replace(/\|/g, ' ').trim());
}

export function getTheme(id = 'B') {
  return THEMES[id] || THEMES.B;
}

function shell(t, inner, bg, fg) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; }
  .stage {
    width:${W}px; height:${H}px; background:${bg}; color:${fg};
    font-family:${t.font}; position:relative; overflow:hidden;
    display:flex; flex-direction:column;
  }
  .brand { position:absolute; top:56px; left:64px; letter-spacing:2px;
           font-weight:800; font-size:34px; color:${t.accent}; }
  .chip { display:inline-block; background:${t.accent}; color:#fff;
          font-weight:800; border-radius:999px; }
  .safe-bottom { position:absolute; left:0; right:0; bottom:0; height:300px; }
</style></head><body>${inner}</body></html>`;
}

/** ① 훅 슬라이드 — 강한 한 줄로 스크롤 정지 */
export function buildHook(t, { category, caption }) {
  const inner = `
  <div class="stage" style="justify-content:center; padding:120px 80px 380px;">
    <div class="brand">atoztem</div>
    <div class="chip" style="align-self:flex-start; font-size:38px; padding:14px 34px; margin-bottom:40px;">${esc(category)}</div>
    <div style="font-size:118px; font-weight:900; line-height:1.18; letter-spacing:-3px;">${esc(caption)}</div>
    <div style="margin-top:56px; font-size:44px; color:${t.sub}; font-weight:600;">끝까지 보면 가격까지 공개 👇</div>
  </div>`;
  return shell(t, inner, t.coverBg, t.coverFg);
}

/** ② 상품 공개 슬라이드 — 이미지 + 이름 + 가격 */
export function buildProduct(t, { product, caption }) {
  const name = cleanName(product.productName);
  const rocket = product.isRocket
    ? `<span class="chip" style="font-size:32px; padding:10px 26px;">로켓배송</span>`
    : '';
  const cap = caption
    ? `<div style="font-size:46px; font-weight:700; color:${t.accent}; margin-bottom:24px;">${esc(caption)}</div>`
    : '';
  const inner = `
  <div class="stage" style="padding:150px 80px 340px;">
    <div class="brand">atoztem</div>
    <div style="width:100%; height:760px; background:${t.card}; border-radius:48px;
                display:flex; align-items:center; justify-content:center; overflow:hidden;">
      <img src="${esc(product.productImage)}" style="max-width:88%; max-height:88%; object-fit:contain;">
    </div>
    <div style="margin-top:44px; display:flex; gap:16px;">${rocket}</div>
    ${cap}
    <div style="margin-top:20px; font-size:60px; font-weight:800; line-height:1.28;
                display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${name}</div>
    <div style="margin-top:auto; font-size:104px; font-weight:900; color:${t.priceColor};">${won(product.productPrice)}</div>
  </div>`;
  return shell(t, inner, t.bg, t.fg);
}

/** ③ 포인트 슬라이드 — 큰 번호 + 셀링포인트 한 줄 (+ 작은 썸네일) */
export function buildPoint(t, { product, index, caption }) {
  const thumb = product.productImage
    ? `<div style="position:absolute; right:70px; bottom:360px; width:280px; height:280px;
         background:${t.card}; border-radius:36px; display:flex; align-items:center;
         justify-content:center; overflow:hidden;">
         <img src="${esc(product.productImage)}" style="max-width:86%; max-height:86%; object-fit:contain;"></div>`
    : '';
  const inner = `
  <div class="stage" style="justify-content:center; padding:120px 80px 380px;">
    <div class="brand">atoztem</div>
    <div style="font-size:220px; font-weight:900; color:${t.accent}; line-height:1;">${index}</div>
    <div style="margin-top:32px; font-size:82px; font-weight:900; line-height:1.28; letter-spacing:-2px;">${esc(caption)}</div>
    ${thumb}
  </div>`;
  return shell(t, inner, t.bg, t.fg);
}

/** ④ CTA 슬라이드 — 링크 유도 + 대가성 문구(공정위) */
export function buildCta(t, { caption, disclosure }) {
  const inner = `
  <div class="stage" style="justify-content:center; padding:120px 80px 380px;">
    <div class="brand">atoztem</div>
    <div style="font-size:96px; font-weight:900; line-height:1.22; letter-spacing:-2px;">${esc(caption)}</div>
    <div style="margin-top:48px; font-size:58px; font-weight:800; color:${t.accent}; line-height:1.35;">
      👇 더보기·고정댓글에<br>구매 링크 있어요</div>
    <div style="margin-top:64px; font-size:30px; color:${t.sub}; line-height:1.5;">${esc(disclosure)}</div>
  </div>`;
  return shell(t, inner, t.coverBg, t.coverFg);
}
