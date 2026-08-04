// '오늘의 스토리' 페이지 — 반자동 링크스티커용.
// 사용자가 폰에서 열어 ① 이미지 저장 ② 스토리 올리기 ③ 링크 스티커에 딥링크 붙여넣기(복사 버튼).
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

function itemHtml(s, today) {
  return `
  <div class="card${today ? ' today' : ''}">
    <img class="shot" src="${esc(s.image)}" alt="스토리 카드" loading="lazy">
    <div class="name">${esc(s.name)}</div>
    <div class="price">${won(s.price)}</div>
    <div class="urlbox">
      <input class="url" value="${esc(s.url)}" readonly onclick="this.select()">
      <button class="copy" onclick="cp(this,'${esc(s.url)}')">링크 복사</button>
    </div>
  </div>`;
}

/**
 * 스토리 페이지 생성 → docs/story.html
 * @param {Array<{date:string,name:string,price:number,url:string,image:string}>} stories  최신순
 */
export function buildStoryPage(stories) {
  const list = Array.isArray(stories) ? stories : [];
  const todayDate = list[0]?.date;
  const todays = list.filter((s) => s.date === todayDate);
  const past = list.filter((s) => s.date !== todayDate).slice(0, 8);

  const html = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>atoztem — 오늘의 스토리</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#fbf6ef;color:#2b2b2b;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
       max-width:520px;margin:0 auto;padding:22px 16px 60px;}
  .brand{font-size:24px;font-weight:900;color:#e07a5f;text-align:center;letter-spacing:1px;}
  .steps{background:#fff;border-radius:16px;padding:16px 18px;margin:16px 0 8px;box-shadow:0 3px 12px rgba(0,0,0,.05);
         font-size:14px;font-weight:700;line-height:1.9;color:#5c5145;}
  .steps b{color:#e07a5f;}
  .sec{font-size:16px;font-weight:900;margin:22px 4px 12px;}
  .sec.past{color:#a08e7d;border-top:1px dashed #e3d7c7;padding-top:20px;margin-top:30px;}
  .card{background:#fff;border-radius:18px;padding:14px;margin-bottom:16px;box-shadow:0 3px 12px rgba(0,0,0,.06);}
  .card.today{border:2px solid #e07a5f;}
  .shot{width:100%;border-radius:12px;display:block;}
  .name{font-size:14px;font-weight:700;margin-top:10px;line-height:1.3;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .price{font-size:17px;font-weight:900;margin-top:3px;}
  .urlbox{display:flex;gap:8px;margin-top:10px;}
  .url{flex:1;min-width:0;font-size:12px;padding:10px;border:1px solid #e3d7c7;border-radius:10px;background:#faf6ef;color:#5c5145;}
  .copy{flex:0 0 auto;background:#e07a5f;color:#fff;font-weight:800;font-size:13px;border:0;
        padding:10px 14px;border-radius:10px;}
  .copy:active{transform:scale(.96)}
  .save{font-size:12px;color:#a08e7d;font-weight:700;margin-top:8px;text-align:center;}
  .disc{margin-top:26px;font-size:11px;color:#b6a794;line-height:1.6;text-align:center}
  .empty{text-align:center;color:#a08e7d;font-weight:700;padding:40px 0;}
</style></head>
<body>
  <div class="brand">atoztem · 오늘의 스토리</div>
  <div class="steps">
    ① 카드 이미지 <b>꾹 눌러 저장</b><br>
    ② 인스타 <b>스토리에 올리기</b><br>
    ③ <b>링크 스티커</b> 추가 → 아래 <b>[링크 복사]</b> 눌러 붙여넣기
  </div>
  ${todays.length ? `<div class="sec">📌 오늘 (${esc(fmtDate(todayDate))})</div>${todays.map((s) => itemHtml(s, true)).join('')}` : '<div class="empty">오늘 스토리 준비 중이에요</div>'}
  ${past.length ? `<div class="sec past">🗂 지난 스토리</div>${past.map((s) => itemHtml(s, false)).join('')}` : ''}
  <div class="disc">${esc(DISCLOSURE)}</div>
<script>
function cp(btn, url){
  navigator.clipboard.writeText(url).then(function(){
    var o=btn.textContent; btn.textContent='복사됨 ✓';
    setTimeout(function(){btn.textContent=o;}, 1500);
  });
}
</script>
</body></html>`;

  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/story.html', html);
  return 'docs/story.html';
}
