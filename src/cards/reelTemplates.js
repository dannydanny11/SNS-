// 릴스 전용 9:16(1080×1920) 카드 템플릿 — 세로 화면을 꽉 채우는 레이아웃.
const W = 1080;
const H = 1920;
// 인스타 안전 구역 — 릴스는 위(계정명·오디오)와 아래(캡션·버튼)를 앱 UI가 덮는다.
// 실제 게시물에서 훅 문구가 계정명에 가려지는 걸 확인해 여백을 확보함(2026-08-07).
const SAFE_TOP = 236;
const SAFE_BOTTOM = 376;
const SIDE = 78;

function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : n;
}
function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function cleanName(name = '') {
  return esc(name.split(',')[0].replace(/\|/g, ' ').trim());
}

function shell(t, inner, bg, fg) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${W}px;height:${H}px}
    .card{width:${W}px;height:${H}px;background:${bg};color:${fg};font-family:${t.font};
          position:relative;overflow:hidden;display:flex;flex-direction:column}
  </style></head><body>${inner}</body></html>`;
}

/** 릴스 표지 (9:16) — 훅 + 제품 콜라주 */
export function buildReelCover(theme, { headline, category, total, products = [] }) {
  const t = theme;
  const tiles = products
    .slice(0, 4)
    .map(
      (p) =>
        `<div style="background:#fff;border-radius:32px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
           <img src="${esc(p.productImage)}" style="width:100%;height:100%;object-fit:cover;"></div>`
    )
    .join('');
  // 릴스 첫 프레임: 인트로/로고 없이 곧바로 큰 훅 + 제품(무음·2초컷 대비)
  const inner = `
  <div class="card" style="padding:84px 80px;">
    <div style="font-size:44px;color:${t.sub};font-weight:800;">${esc(category)} BEST ${total}</div>
    <div style="margin-top:18px;font-size:118px;font-weight:900;line-height:1.12;letter-spacing:-3px;white-space:pre-line;">${esc(headline)}</div>
    <div style="margin-top:54px;flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:24px;">
      ${tiles}
    </div>
  </div>`;
  return shell(t, inner, t.coverBg, t.coverFg);
}

/** 릴스 제품 카드 (9:16) — 큰 이미지 + 아래 정보 */
export function buildReelProduct(theme, { index, total, product }) {
  const t = theme;
  const rocket = product.isRocket
    ? `<span style="background:${t.accent};color:#fff;font-size:34px;font-weight:800;padding:12px 28px;border-radius:999px;">로켓배송</span>`
    : '';
  const copy = product.copy
    ? `<div style="margin-top:26px;font-size:48px;font-weight:800;color:${t.accent};line-height:1.3;">${esc(product.copy)}</div>`
    : '';
  const inner = `
  <div class="card" style="padding:80px 80px 90px;">
    <div style="position:absolute;top:70px;right:80px;color:${t.sub};font-size:40px;font-weight:800;">${index} / ${total}</div>
    <div style="width:100%;height:1020px;background:${t.card};border-radius:48px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto;">
      <img src="${esc(product.productImage)}" style="max-width:92%;max-height:92%;object-fit:contain;">
    </div>
    <div style="margin-top:40px;display:flex;gap:16px;align-items:center;">${rocket}</div>
    ${copy}
    <div style="margin-top:18px;font-size:54px;font-weight:800;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${cleanName(product.productName)}</div>
    <div style="margin-top:auto;">
      <div style="font-size:92px;font-weight:900;color:${t.priceColor};line-height:1;">${won(product.productPrice)}</div>
      <div style="margin-top:14px;font-size:36px;font-weight:700;color:${t.sub};">와우·쿠폰가는 링크에서 더 저렴 ↓</div>
    </div>
  </div>`;
  return shell(t, inner, t.bg, t.fg);
}

/** 단품 릴스 표지 (9:16) — 큰 훅 + 제품 이미지 하나 크게 */
export function buildReelSingleCover(theme, { headline, category, product }) {
  const t = theme;
  const inner = `
  <div class="card" style="padding:${SAFE_TOP}px ${SIDE}px ${SAFE_BOTTOM}px;">
    <div style="font-size:42px;color:${t.sub};font-weight:800;">${esc(category)} · 이번 주 추천</div>
    <div style="margin-top:16px;font-size:118px;font-weight:900;line-height:1.1;letter-spacing:-3px;white-space:pre-line;">${esc(headline)}</div>
    <div style="margin-top:42px;flex:1;min-height:0;background:#fff;border-radius:44px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
      <img src="${esc(product.productImage)}" style="max-width:90%;max-height:90%;object-fit:contain;">
    </div>
  </div>`;
  return shell(t, inner, t.coverBg, t.coverFg);
}

// 슬라이드별 제품 이미지 구도(확대/이동) — 같은 이미지를 여러 컷처럼 보이게
const IMG_VIEWS = [
  'transform:scale(1.0);',                    // 전체
  'transform:scale(1.5) translateY(13%);',    // 위쪽 클로즈업
  'transform:scale(1.7);',                    // 중앙 디테일
  'transform:scale(1.5) translateY(-13%);',   // 아래쪽 클로즈업
  'transform:scale(1.4) translateX(11%);',    // 좌측
  'transform:scale(1.4) translateX(-11%);',   // 우측
];

/** 단품 릴스 장점 슬라이드 (9:16) — 이미지(슬라이드별 다른 구도) + 장점 문구(+선택 가격) */
export function buildReelBenefit(theme, { product, benefit, step, steps, showPrice }) {
  const t = theme;
  const dots = Array.from({ length: steps }, (_, k) =>
    `<span style="width:22px;height:22px;border-radius:50%;background:${k === step ? t.accent : '#00000022'};display:inline-block;margin-right:12px;"></span>`
  ).join('');
  const price = showPrice
    ? `<div style="margin-top:20px;"><span style="font-size:84px;font-weight:900;color:${t.priceColor};">${won(product.productPrice)}</span>
         <span style="font-size:34px;font-weight:700;color:${t.sub};margin-left:14px;">와우·쿠폰가는 링크에서 더 저렴 ↓</span></div>`
    : '';
  const view = IMG_VIEWS[step % IMG_VIEWS.length];
  const inner = `
  <div class="card" style="padding:${SAFE_TOP}px ${SIDE}px ${SAFE_BOTTOM}px;">
    <div style="width:100%;height:760px;background:${t.card};border-radius:48px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto;">
      <img src="${esc(product.productImage)}" style="max-width:92%;max-height:92%;object-fit:contain;${view}">
    </div>
    <div style="margin-top:40px;">${dots}</div>
    <div style="margin-top:22px;font-size:62px;font-weight:900;line-height:1.32;letter-spacing:-1px;">${esc(benefit)}</div>
    ${price}
  </div>`;
  return shell(t, inner, t.bg, t.fg);
}

/** 단품 릴스 마무리 CTA (9:16) — 다른 추천템 미니 모음으로 링크 클릭 유도 */
export function buildReelTeaserCta(theme, { others = [], buyHook = '이 가격이면 사야죠' }) {
  const t = theme;
  const tiles = others
    .slice(0, 4)
    .map(
      (p) =>
        `<div style="background:#fff;border-radius:28px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
           <img src="${esc(p.productImage)}" style="width:100%;height:100%;object-fit:cover;"></div>`
    )
    .join('');
  const inner = `
  <div class="card" style="padding:${SAFE_TOP}px ${SIDE}px ${SAFE_BOTTOM}px;">
    <div style="color:${t.accent};font-size:42px;font-weight:800;letter-spacing:2px;">atoztem</div>
    <div style="margin-top:16px;font-size:88px;font-weight:900;line-height:1.2;">${esc(buyHook)}</div>
    <div style="margin-top:14px;font-size:38px;font-weight:700;color:${t.sub};">이번 주 추천템 더 있어요</div>
    <div style="margin-top:22px;font-size:50px;font-weight:800;color:${t.accent};">👉 프로필 링크에서 바로 구매</div>
    <div style="margin-top:36px;flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:22px;">
      ${tiles}
    </div>
    <div style="margin-top:28px;font-size:28px;color:${t.sub};line-height:1.55;">
      이 게시물은 쿠팡 파트너스 활동의 일환으로,<br>이에 따른 일정액의 수수료를 제공받습니다.
    </div>
  </div>`;
  return shell(t, inner, t.coverBg, t.coverFg);
}

/** 릴스 CTA (9:16) */
export function buildReelCta(theme) {
  const t = theme;
  const inner = `
  <div class="card" style="padding:90px 80px;justify-content:center;align-items:flex-start;">
    <div style="position:absolute;top:80px;left:80px;color:${t.accent};font-size:42px;font-weight:800;letter-spacing:2px;">atoztem</div>
    <div style="font-size:110px;font-weight:900;line-height:1.18;letter-spacing:-1px;">마음에 든 게<br>있으셨나요?</div>
    <div style="margin-top:56px;font-size:60px;font-weight:800;color:${t.accent};line-height:1.3;">👉 프로필 링크에서<br>&nbsp;&nbsp;&nbsp;전체 확인하세요</div>
    <div style="margin-top:72px;font-size:34px;color:${t.sub};line-height:1.6;">
      이 게시물은 쿠팡 파트너스 활동의 일환으로,<br>이에 따른 일정액의 수수료를 제공받습니다.
    </div>
  </div>`;
  return shell(t, inner, t.coverBg, t.coverFg);
}
