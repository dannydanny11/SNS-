// 스토리 전용 9:16(1080×1920) 카드 — 링크 스티커(수동)로 바로 구매 유도.
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

/**
 * 스토리 카드 — 상단은 링크 스티커 놓을 여백, 가운데 큰 제품 이미지 + 훅/가격.
 * @param {object} theme
 * @param {{product:object, hook:string, category?:string}} data
 */
export function buildStoryCard(theme, { product, hook, category = '' }) {
  const t = theme;
  const inner = `
  <div style="width:${W}px;height:${H}px;background:${t.coverBg};color:${t.coverFg};
       font-family:${t.font};position:relative;overflow:hidden;display:flex;flex-direction:column;
       padding:120px 84px 96px;">
    <!-- 상단: 링크 스티커 놓을 자리 안내 -->
    <div style="text-align:center;color:${t.accent};font-size:46px;font-weight:900;">👆 위 링크 눌러 바로 구매</div>
    <div style="margin-top:6px;text-align:center;color:${t.sub};font-size:30px;font-weight:700;">${esc(category)} · atoztem 오늘의 추천</div>

    <!-- 훅 -->
    <div style="margin-top:40px;text-align:center;font-size:96px;font-weight:900;line-height:1.12;letter-spacing:-2px;white-space:pre-line;">${esc(hook)}</div>

    <!-- 제품 이미지 -->
    <div style="margin-top:44px;flex:1;min-height:0;background:#fff;border-radius:48px;
         display:flex;align-items:center;justify-content:center;overflow:hidden;">
      <img src="${esc(product.productImage)}" style="max-width:90%;max-height:90%;object-fit:contain;">
    </div>

    <!-- 이름 + 가격 -->
    <div style="margin-top:36px;text-align:center;font-size:44px;font-weight:800;line-height:1.3;
         display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${cleanName(product.productName)}</div>
    <div style="margin-top:18px;text-align:center;">
      <span style="font-size:88px;font-weight:900;color:${t.priceColor};">${won(product.productPrice)}</span>
    </div>
    <div style="margin-top:12px;text-align:center;font-size:34px;font-weight:700;color:${t.sub};">와우·쿠폰가는 링크에서 더 저렴</div>
  </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px}</style></head><body>${inner}</body></html>`;
}
