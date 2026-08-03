// 프로필 링크 페이지 생성 (GitHub Pages 호스팅 → 인스타 프로필 링크에 고정).
// 아카이브 구조: 오늘 상품(맨 위) + 지난 상품(날짜별)을 모두 노출해 과거 게시분도 구매 가능.
import { writeFileSync, mkdirSync } from 'node:fs';
import { DISCLOSURE } from './caption.js';

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : n;
}
function fmtDate(d = '') {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : d;
}

function itemHtml(p) {
  const url = esc(p.url);
  const copy = p.copy
    ? `<div class="copy">${esc(p.copy)}</div>`
    : '';
  return `
  <a class="item" href="${url}" target="_blank" rel="noopener">
    <div class="thumb"><img src="${esc(p.image)}" alt="" loading="lazy"></div>
    <div class="info">
      ${copy}
      <div class="name">${esc(p.name)}</div>
      <div class="price">${won(p.price)}</div>
      <div class="note">와우·쿠폰가는 링크에서 ↓</div>
    </div>
    <div class="go">구매 →</div>
  </a>`;
}

/**
 * 링크 페이지 HTML 생성 후 docs/index.html 에 저장.
 * @param {Array<{date:string, category:string, products:Array}>} archive  최신순
 */
export function buildLinkPage(archive) {
  const list = Array.isArray(archive) ? archive : [];
  const today = list[0];
  const past = list.slice(1);

  const todayHtml = today
    ? `<div class="sec">📌 <span class="cat-main">${esc(today.category)}</span></div>
       ${today.products.map(itemHtml).join('')}`
    : '';

  const pastHtml = past.length
    ? `<div class="sec past">🗂 지난 추천템</div>` +
      past
        .map(
          (e) =>
            `<div class="day">${fmtDate(e.date)} · ${esc(e.category)}</div>` +
            e.products.map(itemHtml).join('')
        )
        .join('')
    : '';

  const html = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>atoztem — 추천템 모음</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#fbf6ef;color:#2b2b2b;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
       max-width:520px;margin:0 auto;padding:26px 16px 60px;}
  .brand{font-size:26px;font-weight:900;color:#e07a5f;letter-spacing:1px;text-align:center;}
  .tagline{text-align:center;color:#a08e7d;font-weight:600;margin:5px 0 20px;font-size:13px;}
  .sec{font-size:17px;font-weight:900;margin:20px 4px 12px;}
  .sec .cat{font-size:13px;font-weight:700;color:#a08e7d;margin-left:6px;}
  .sec.past{color:#a08e7d;margin-top:34px;border-top:1px dashed #e3d7c7;padding-top:22px;}
  .day{font-size:13px;font-weight:800;color:#a08e7d;margin:16px 4px 8px;}
  .item{display:flex;align-items:center;gap:12px;background:#fff;border-radius:16px;padding:12px;
        margin-bottom:11px;text-decoration:none;color:inherit;box-shadow:0 3px 12px rgba(0,0,0,.05);}
  .item:active{transform:scale(.98)}
  .thumb{width:66px;height:66px;border-radius:11px;overflow:hidden;flex:0 0 66px;background:#f2ece3;
         display:flex;align-items:center;justify-content:center;}
  .thumb img{max-width:100%;max-height:100%;object-fit:contain}
  .info{flex:1;min-width:0}
  .copy{font-size:12.5px;font-weight:800;color:#e07a5f;margin-bottom:2px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .name{font-size:14px;font-weight:700;line-height:1.3;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .price{font-size:16px;font-weight:900;margin-top:3px}
  .note{font-size:11px;font-weight:700;color:#c4b6a4;margin-top:2px}
  .go{flex:0 0 auto;background:#e07a5f;color:#fff;font-weight:800;font-size:13px;
      padding:9px 13px;border-radius:999px;white-space:nowrap}
  .disc{margin-top:28px;font-size:11.5px;color:#b6a794;line-height:1.6;text-align:center}
</style></head>
<body>
  <div class="brand">atoztem</div>
  <div class="tagline">매주 올라오는 가성비템 · 이미지를 눌러 구매</div>
  ${todayHtml}
  ${pastHtml}
  <div class="disc">${esc(DISCLOSURE)}</div>
</body></html>`;

  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/index.html', html);
  return 'docs/index.html';
}
