// 프로필 링크 페이지 생성 (GitHub Pages 로 호스팅 → 인스타 프로필 링크에 고정).
// 매 실행마다 docs/index.html 을 갱신해 항상 최신 상품을 보여준다.
import { writeFileSync, mkdirSync } from 'node:fs';
import { DISCLOSURE } from './caption.js';

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : n;
}
function cleanName(name = '') {
  return esc(name.split(',')[0].replace(/\|/g, ' ').trim());
}

/**
 * 링크 페이지 HTML 생성 후 docs/index.html 에 저장.
 * @param {{category:object, products:Array, links:Array}} data
 */
export function buildLinkPage({ category, products, links }) {
  const items = products
    .map((p, i) => {
      const url = esc(links[i]?.url || p.productUrl);
      return `
      <a class="item" href="${url}" target="_blank" rel="noopener">
        <div class="thumb"><img src="${esc(p.productImage)}" alt=""></div>
        <div class="info">
          <div class="name">${cleanName(p.productName)}</div>
          <div class="price">${won(p.productPrice)}</div>
        </div>
        <div class="go">구매하러 가기 →</div>
      </a>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>atoztem — 오늘의 추천템</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#fbf6ef;color:#2b2b2b;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
       max-width:520px;margin:0 auto;padding:28px 18px 60px;}
  .brand{font-size:26px;font-weight:900;color:#e07a5f;letter-spacing:1px;text-align:center;}
  .cat{text-align:center;color:#a08e7d;font-weight:700;margin:6px 0 22px;font-size:15px;}
  .item{display:flex;align-items:center;gap:14px;background:#fff;border-radius:18px;padding:14px;
        margin-bottom:14px;text-decoration:none;color:inherit;box-shadow:0 4px 14px rgba(0,0,0,.06);
        transition:transform .1s;}
  .item:active{transform:scale(.98)}
  .thumb{width:74px;height:74px;border-radius:12px;overflow:hidden;flex:0 0 74px;background:#f2ece3;
         display:flex;align-items:center;justify-content:center;}
  .thumb img{max-width:100%;max-height:100%;object-fit:contain}
  .info{flex:1;min-width:0}
  .name{font-size:15px;font-weight:700;line-height:1.35;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .price{font-size:17px;font-weight:900;margin-top:4px}
  .go{flex:0 0 auto;background:#e07a5f;color:#fff;font-weight:800;font-size:13px;
      padding:9px 12px;border-radius:999px;white-space:nowrap}
  .disc{margin-top:26px;font-size:12px;color:#a08e7d;line-height:1.6;text-align:center}
</style></head>
<body>
  <div class="brand">atoztem</div>
  <div class="cat">${esc(category.name)} · 오늘의 추천템</div>
  ${items}
  <div class="disc">${esc(DISCLOSURE)}</div>
</body></html>`;

  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/index.html', html);
  return 'docs/index.html';
}
