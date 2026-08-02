// 카드 HTML 생성 — 표지 / 제품 / CTA. 테마를 받아 1080×1080 자기완결 HTML 반환.
const SIZE = 1080;

function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : n;
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 상품명을 카드용으로 짧게 정리 (옵션·모델명 꼬리 제거) */
function cleanName(name = '') {
  return escapeHtml(name.split(',')[0].replace(/\|/g, ' ').trim());
}

function shell(t, inner, bg, fg) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${SIZE}px; height:${SIZE}px; }
  .card {
    width:${SIZE}px; height:${SIZE}px;
    background:${bg}; color:${fg};
    font-family:${t.font};
    position:relative; overflow:hidden;
    display:flex; flex-direction:column;
  }
  .brand { position:absolute; letter-spacing:2px; font-weight:800; }
</style></head><body>${inner}</body></html>`;
}

/** 표지(훅) 카드 — 제품 이미지 콜라주 + 훅 (썸네일 역할) */
export function buildCover(theme, { headline, category, total, products = [] }) {
  const t = theme;
  const tiles = products
    .slice(0, 4)
    .map(
      (p) =>
        `<div style="background:#fff; border-radius:26px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
           <img src="${escapeHtml(p.productImage)}" style="width:100%; height:100%; object-fit:cover;">
         </div>`
    )
    .join('');
  const inner = `
  <div class="card" style="padding:66px; flex-direction:column;">
    <div style="color:${t.accent}; font-size:34px; font-weight:800; letter-spacing:2px;">atoztem</div>
    <div style="margin-top:22px; font-size:36px; color:${t.sub}; font-weight:700;">${escapeHtml(category)}</div>
    <div style="margin-top:10px; font-size:78px; font-weight:900; line-height:1.14; letter-spacing:-2px; white-space:pre-line;">${escapeHtml(headline)}</div>
    <div style="margin-top:26px; display:flex; align-items:center; gap:16px;">
      <span style="background:${t.accent}; color:#fff; font-size:34px; font-weight:800; padding:12px 30px; border-radius:999px;">BEST ${total}</span>
      <span style="font-size:32px; color:${t.sub};">밀어서 보기 →</span>
    </div>
    <div style="margin-top:34px; flex:1; min-height:0; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:18px;">
      ${tiles}
    </div>
  </div>`;
  return shell(t, inner, t.coverBg, t.coverFg);
}

/** 제품 정보 카드 */
export function buildProduct(theme, { index, total, product }) {
  const t = theme;
  const name = cleanName(product.productName);
  const price = won(product.productPrice);
  const rocket = product.isRocket
    ? `<span style="background:${t.accent}; color:#fff; font-size:30px; font-weight:800; padding:10px 24px; border-radius:999px;">로켓배송</span>`
    : '';
  const inner = `
  <div class="card" style="padding:80px 84px;">
    <div class="brand" style="top:64px; right:84px; color:${t.sub}; font-size:30px;">${index} / ${total}</div>
    <div style="width:100%; height:460px; background:${t.card}; border-radius:40px;
                display:flex; align-items:center; justify-content:center; overflow:hidden;">
      <img src="${escapeHtml(product.productImage)}" style="max-width:88%; max-height:88%; object-fit:contain;">
    </div>
    <div style="margin-top:40px; display:flex; gap:16px; align-items:center;">${rocket}</div>
    ${product.copy ? `<div style="margin-top:22px; font-size:40px; font-weight:700; color:${t.accent}; line-height:1.3;">${escapeHtml(product.copy)}</div>` : ''}
    <div style="margin-top:14px; font-size:42px; font-weight:800; line-height:1.3;
                display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${name}</div>
    <div style="margin-top:auto;">
      <div style="font-size:76px; font-weight:900; color:${t.priceColor}; line-height:1;">${price}</div>
      <div style="margin-top:12px; font-size:30px; font-weight:700; color:${t.sub};">와우·쿠폰가는 링크에서 더 저렴 ↓</div>
    </div>
  </div>`;
  return shell(t, inner, t.bg, t.fg);
}

/** CTA(행동유도) 카드 */
export function buildCta(theme, { category }) {
  const t = theme;
  const inner = `
  <div class="card" style="padding:96px 84px; justify-content:center; align-items:flex-start;">
    <div class="brand" style="top:72px; left:84px; color:${t.accent}; font-size:34px;">atoztem</div>
    <div style="font-size:88px; font-weight:900; line-height:1.2; letter-spacing:-1px;">마음에 든 게<br>있으셨나요?</div>
    <div style="margin-top:48px; font-size:52px; font-weight:800; color:${t.accent};">👉 프로필 링크에서<br>&nbsp;&nbsp;&nbsp;&nbsp;전체 확인하세요</div>
    <div style="margin-top:64px; font-size:28px; color:${t.sub}; line-height:1.5;">
      이 게시물은 쿠팡 파트너스 활동의 일환으로,<br>이에 따른 일정액의 수수료를 제공받습니다.
    </div>
  </div>`;
  return shell(t, inner, t.coverBg, t.coverFg);
}
