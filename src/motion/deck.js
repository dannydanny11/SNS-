// 모션덱 릴스 — 애니메이션 타임라인 HTML 생성기 (POC).
//
// 기존 방식: 정지 카드 JPG N장 → ffmpeg 켄번스 줌 → mp4
// 이 방식  : 씬 전체가 들어있는 HTML 1장 + window.__seek(ms)로 시간을 되감을 수 있는
//            결정론적 타임라인 → Puppeteer가 프레임마다 seek+screenshot → mp4
//
// 핵심 설계:
//  · 모든 모션은 Web Animations API 로 등록 후 즉시 pause().
//    seek(ms) 는 모든 애니메이션의 currentTime 을 같은 값으로 밀어넣는다.
//    → 렌더 속도와 무관하게 프레임이 정확히 재현된다(무작위·실시간 요소 없음).
//  · delay 가 애니메이션 자체 타임라인에 포함되므로 currentTime=글로벌ms 로 충분.
//  · 등장(enter)은 fill:'both'(시작 전 = 시작값 유지 → 등장 전 숨김),
//    퇴장(exit)은 fill:'forwards'(시작 전엔 아무 영향 없음 → enter 를 덮어쓰지 않음).
//  · transform 을 두 개 이상이 동시에 건드리면 나중 것이 이겨버리므로
//    등장/켄번스/루프(둥실)는 반드시 서로 다른 중첩 엘리먼트에 건다.
const W = 1080;
const H = 1920;

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : String(n || '');
}
function cleanName(name = '') {
  return esc(String(name).split(',')[0].replace(/\|/g, ' ').trim());
}

// 같은 상품 이미지를 다른 컷처럼 보이게 하는 구도(기존 reelTemplates 의 IMG_VIEWS 계승)
const VIEWS = [
  'scale(1.0)',
  'scale(1.45) translateY(12%)',
  'scale(1.65)',
  'scale(1.45) translateY(-12%)',
  'scale(1.38) translateX(10%)',
  'scale(1.38) translateX(-10%)',
];
const BADGES = ['✨', '👌', '🙌', '🔥', '💡', '😌'];
// 구매 유도 훅 — 상품별 buyHook 이 없을 때 쓰는 기본값.
// 허위 긴급성("품절 임박")·허위 후기는 금지, "사도 좋다"는 의견 표현만.
const BUY_FALLBACK = ['이 가격이면 사야죠', '지금 사두면 이득', '장바구니 직행각'];
// 씬마다 배경 blob 색을 살짝 바꿔 "같은 화면 반복" 느낌 제거
const MOODS = [
  ['#F2B705', '#E0654A'],
  ['#8FC7B0', '#E0654A'],
  ['#F2B705', '#8FC7B0'],
  ['#E0654A', '#C9A227'],
  ['#8FC7B0', '#F2B705'],
  ['#E0654A', '#8FC7B0'],
];

function hookFontSize(hook = '') {
  const n = hook.replace(/\s/g, '').length;
  if (n <= 7) return 142;
  if (n <= 10) return 120;
  if (n <= 14) return 100;
  return 84;
}

/** 훅을 글자 단위로 쪼개 순차 등장시킨다(한글은 어절보다 글자가 리듬이 좋음) */
function splitChars(text, kind = 'riseFast') {
  return [...String(text)]
    .map((ch) => {
      if (ch === '\n') return '<br>';
      if (ch === ' ') return '<span class="sp"> </span>';
      return `<span class="ch" data-anim="${kind}">${esc(ch)}</span>`;
    })
    .join('');
}

/** 본문은 어절 단위 마스크 리빌 */
function splitWords(text) {
  return String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<span class="wd" data-anim="mask">${esc(w)}</span>`)
    .join(' ');
}

function blobs(i) {
  const [c1, c2] = MOODS[i % MOODS.length];
  return `
    <div class="blob" data-loop="drift" style="left:-260px;top:-200px;width:900px;height:900px;background:${c1}"></div>
    <div class="blob" data-loop="drift2" style="right:-320px;bottom:-260px;width:1000px;height:1000px;background:${c2}"></div>`;
}

const MASCOT = `
<svg viewBox="0 0 200 210" width="100%" height="100%">
  <ellipse cx="100" cy="196" rx="54" ry="9" fill="#00000014"/>
  <path d="M100 40V18" stroke="#E0654A" stroke-width="8" stroke-linecap="round"/>
  <circle cx="100" cy="13" r="11" fill="#F2B705"/>
  <path d="M40 100c0-33 27-58 60-58s60 25 60 58v24c0 30-27 52-60 52s-60-22-60-52z" fill="#E0654A"/>
  <circle cx="60" cy="126" r="10" fill="#fff" opacity=".33"/>
  <circle cx="140" cy="126" r="10" fill="#fff" opacity=".33"/>
  <g class="eyes">
    <ellipse class="eye" cx="79" cy="108" rx="9" ry="11" fill="#2B211C"/>
    <ellipse class="eye" cx="121" cy="108" rx="9" ry="11" fill="#2B211C"/>
  </g>
  <path d="M88 132q12 11 24 0" stroke="#2B211C" stroke-width="7" fill="none" stroke-linecap="round"/>
  <g class="arm"><path d="M156 116q24-4 30-26" stroke="#E0654A" stroke-width="15" fill="none" stroke-linecap="round"/></g>
</svg>`;

/**
 * 모션덱 HTML 생성.
 * @param {object} o
 * @param {object} o.product        {productName, productPrice, ...}
 * @param {string} o.image          상품 이미지 (data URI 권장)
 * @param {string} o.hook
 * @param {string} o.category
 * @param {string[]} o.benefits     장점 문장(씬 1개당 1문장)
 * @param {string[]} o.otherImages  마지막 CTA 미니모음 이미지 4장
 * @param {number[]} o.durations    씬별 길이(초). 길이 = 1 + benefits.length + 1
 * @returns {string} HTML
 */
export function buildMotionDeckHtml(o) {
  const { product, image, hook, category = '', benefits = [], otherImages = [], durations } = o;
  const buyHook =
    (o.buyHook || product.buyHook || '').trim() ||
    BUY_FALLBACK[(Number(product.productId) || 0) % BUY_FALLBACK.length];
  const scenes = [];
  let acc = 0;
  for (const d of durations) {
    scenes.push({ start: +acc.toFixed(3), end: +(acc + d).toFixed(3) });
    acc += d;
  }
  const total = +acc.toFixed(3);
  const nBen = benefits.length;
  const priceSceneIdx = nBen; // 마지막 장점 씬에서 가격 공개

  // ── 씬 0: 표지(훅) ────────────────────────────────────────────────
  const cover = `
<section class="scene cover">
  <div class="sbg">${blobs(0)}</div>
  <div class="pad">
    <div class="chip" data-anim="fade" data-dur="0.26" data-delay="0">${esc(category)} · 이번 주 추천</div>
    <h1 class="hook" data-stagger="0.022" data-delay="0.01" style="font-size:${hookFontSize(hook)}px">${splitChars(hook)}</h1>
    <div class="ul" data-anim="bar" data-dur="0.42" data-delay="0.26"></div>
    <div class="frame" data-anim="imgFast" data-delay="0">
      <div class="kb" data-ken="in">
        <div class="plate"><img src="${esc(image)}"></div>
      </div>
      <span class="emo" style="left:-26px;top:34px" data-anim="pop" data-delay="0.62"><i data-loop="bob">✨</i></span>
      <span class="emo" style="right:-24px;top:210px" data-anim="pop" data-delay="0.74"><i data-loop="bob2">👀</i></span>
      <span class="emo" style="left:52px;bottom:-34px" data-anim="pop" data-delay="0.86"><i data-loop="bob">👍</i></span>
    </div>
  </div>
  <div class="mascot" style="right:34px;bottom:-6px;width:212px" data-anim="pop" data-delay="0.98">
    <div data-loop="bob">${MASCOT}</div>
  </div>
</section>`;

  // ── 씬 1..N: 장점 ────────────────────────────────────────────────
  const benefitScenes = benefits
    .map((b, i) => {
      const sIdx = i + 1;
      const dots = Array.from({ length: nBen }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
      const priceBlock =
        sIdx === priceSceneIdx
          ? `<div class="price" data-anim="rise" data-delay="0.70">
               <div class="wonrow">
                 <span class="won" data-count-to="${Number(product.productPrice) || 0}" data-count-delay="0.70" data-count-dur="0.85">${won(product.productPrice)}</span>
                 <span class="buy"><i data-loop="pulse">🛒 지금 담아두기</i></span>
               </div>
               <div class="note"><i data-loop="nudge">와우·쿠폰가는 링크에서 더 저렴 ↓</i></div>
             </div>`
          : `<div class="pname" data-anim="fade" data-delay="0.95">${cleanName(product.productName)}</div>`;
      return `
<section class="scene benefit">
  <div class="sbg">${blobs(sIdx)}</div>
  <div class="pad">
    <div class="step">
      <span class="num" data-anim="pop" data-delay="0.06">${String(sIdx).padStart(2, '0')}</span>
      <span class="dots" data-anim="fade" data-delay="0.10">${dots}</span>
    </div>
    <div class="frame sm">
      <div class="kb" data-ken="${i % 2 ? 'out' : 'in'}">
        <div class="plate"><img src="${esc(image)}" style="transform:${VIEWS[sIdx % VIEWS.length]}"></div>
      </div>
      <span class="badge" data-anim="pop" data-delay="0.60"><i data-loop="pulse">${BADGES[i % BADGES.length]}</i></span>
    </div>
    <div class="body">
      <p class="btext" data-stagger="0.042" data-delay="0.40">${splitWords(b)}</p>
    </div>
    <div class="foot">${priceBlock}</div>
  </div>
</section>`;
    })
    .join('');

  // ── 마지막 씬: CTA ───────────────────────────────────────────────
  const tiles = otherImages
    .slice(0, 4)
    .map((src) => `<div class="tile" data-anim="pop"><img src="${esc(src)}"></div>`)
    .join('');
  const cta = `
<section class="scene cta">
  <div class="sbg">${blobs(nBen + 1)}</div>
  <div class="pad">
    <div class="brand" data-anim="rise" data-delay="0.04">atoztem</div>
    <h2 class="big" data-stagger="0.045" data-delay="0.12">${splitWords(buyHook)}</h2>
    <div class="sub" data-anim="fade" data-delay="0.42">이번 주 추천템 더 있어요</div>
    <div class="go" data-anim="pop" data-delay="0.56"><i data-loop="pulse">👉</i> 프로필 링크에서 바로 구매</div>
    <div class="tiles" data-stagger="0.08" data-delay="0.72">${tiles}</div>
    <div class="disc" data-anim="fade" data-delay="1.20">
      이 게시물은 쿠팡 파트너스 활동의 일환으로,<br>이에 따른 일정액의 수수료를 제공받습니다.
    </div>
  </div>
  <div class="mascot" style="right:56px;top:250px;width:180px" data-anim="pop" data-delay="0.85">
    <div data-loop="bob">${MASCOT}</div>
  </div>
</section>`;

  const GRAIN =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
:root{
  --cream:#FAF4EA; --ink:#221F1C; --sub:#9C8B79;
  --accent:#E0654A; --accent2:#2F6E5E; --white:#fff;
  --font:'Pretendard','Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif;
  /* 인스타 안전 구역 — 릴스는 위(계정명·오디오)와 아래(캡션·버튼)를 앱 UI가 덮는다.
     실측(프로필 게시물 뷰/릴스 탭 모두 대응): 위 236px, 아래 376px 는 비워 둔다. */
  --safe-top:236px; --safe-bottom:376px; --side:78px;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:var(--cream)}
body{font-family:var(--font);color:var(--ink);-webkit-font-smoothing:antialiased}
#stage{position:relative;width:${W}px;height:${H}px;overflow:hidden}

.scene{position:absolute;inset:0;will-change:opacity,transform,filter}
.sbg{position:absolute;inset:0;background:var(--cream);overflow:hidden}
.blob{position:absolute;border-radius:50%;filter:blur(140px);opacity:.42;will-change:transform}
.pad{position:absolute;inset:0;display:flex;flex-direction:column;
     padding:var(--safe-top) var(--side) var(--safe-bottom)}

/* 표지 */
.chip{align-self:flex-start;font-size:38px;font-weight:800;color:var(--accent);
      background:rgba(224,101,74,.13);padding:16px 34px;border-radius:999px}
.hook{margin-top:28px;font-weight:900;line-height:1.06;letter-spacing:-5px}
.hook .ch{display:inline-block;will-change:transform,opacity,filter}
.hook .sp{display:inline-block;width:.3em}
.ul{width:210px;height:14px;margin-top:26px;border-radius:999px;
    background:linear-gradient(90deg,var(--accent),#F2B705);transform-origin:left center}

.frame{position:relative;margin-top:46px;flex:1;min-height:0;will-change:transform,opacity}
.frame.sm{flex:0 0 auto;height:760px;margin-top:26px}
.cover .plate img{max-width:92%;max-height:92%}
.kb{position:absolute;inset:0;will-change:transform}
.plate{width:100%;height:100%;background:var(--white);border-radius:62px;overflow:hidden;
       display:flex;align-items:center;justify-content:center;
       box-shadow:0 44px 96px rgba(94,60,36,.17), 0 4px 12px rgba(94,60,36,.06)}
.plate img{max-width:88%;max-height:88%;object-fit:contain}

.emo{position:absolute;width:136px;height:136px;border-radius:50%;background:var(--white);
     display:flex;align-items:center;justify-content:center;font-size:68px;z-index:4;
     box-shadow:0 20px 44px rgba(94,60,36,.20)}
.emo i{font-style:normal;display:block}
.badge{position:absolute;left:-14px;bottom:-46px;width:152px;height:152px;border-radius:50%;
       background:var(--white);display:flex;align-items:center;justify-content:center;font-size:78px;z-index:4;
       box-shadow:0 22px 48px rgba(94,60,36,.20)}
.badge i{font-style:normal;display:block}
.mascot{position:absolute;z-index:5}
.mascot .eye{transform-box:fill-box;transform-origin:center}
.mascot .arm{transform-box:fill-box;transform-origin:left center}

/* 장점 */
.step{display:flex;align-items:center;gap:26px}
.num{font-size:56px;font-weight:900;color:var(--accent);letter-spacing:-1px;display:inline-block}
.dots{display:inline-flex;gap:12px;align-items:center}
.dots i{width:20px;height:20px;border-radius:50%;background:rgba(34,31,28,.14);display:block}
.dots i.on{background:var(--accent);width:52px;border-radius:999px}
.body{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding-top:30px}
.btext{font-size:62px;font-weight:900;line-height:1.32;letter-spacing:-1.6px}
.btext .wd{display:inline-block;will-change:clip-path,transform,opacity}
.foot{flex:0 0 auto;border-top:3px solid rgba(34,31,28,.09);padding-top:28px}
.pname{font-size:36px;font-weight:700;color:var(--sub);line-height:1.35;
       display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wonrow{display:flex;align-items:center;gap:26px;flex-wrap:wrap}
.price .won{font-size:94px;font-weight:900;line-height:1;letter-spacing:-3px}
.price .buy{font-size:34px;font-weight:800;color:#fff;background:var(--accent2);
            padding:16px 28px;border-radius:999px;white-space:nowrap}
.price .buy i,.price .note i{font-style:normal;display:inline-block}
.price .note{margin-top:14px;font-size:32px;font-weight:700;color:var(--sub)}

/* CTA */
.brand{font-size:42px;font-weight:900;color:var(--accent);letter-spacing:3px}
.big{margin-top:14px;font-size:96px;font-weight:900;line-height:1.14;letter-spacing:-3.5px}
.big .wd{display:inline-block}
.sub{margin-top:14px;font-size:40px;font-weight:700;color:var(--sub)}
.go{align-self:flex-start;margin-top:26px;font-size:44px;font-weight:800;color:#fff;
    background:var(--accent);padding:22px 40px;border-radius:999px;
    box-shadow:0 20px 44px rgba(224,101,74,.34)}
.go i{font-style:normal;display:inline-block}
.tiles{margin-top:38px;flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:22px}
.tile{background:var(--white);border-radius:34px;overflow:hidden;display:flex;align-items:center;justify-content:center;
      box-shadow:0 20px 46px rgba(94,60,36,.13)}
.tile img{width:100%;height:100%;object-fit:cover}
.disc{margin-top:28px;font-size:27px;color:var(--sub);line-height:1.55}

/* HUD */
.grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.055;
       mix-blend-mode:multiply;pointer-events:none;z-index:20}
.hud{position:absolute;inset:0;z-index:15;pointer-events:none}
/* 진행바도 안전 구역 안으로 — 맨 위에 두면 계정명 오버레이에 가린다 */
.pbar{position:absolute;left:var(--side);right:var(--side);top:calc(var(--safe-top) - 48px);
      height:9px;border-radius:999px;background:rgba(34,31,28,.10);overflow:hidden}
.pbar>i{display:block;height:100%;width:0;border-radius:999px;
        background:linear-gradient(90deg,var(--accent),#F2B705)}
</style></head><body>
<div id="stage">
  <div class="scenes">${cover}${benefitScenes}${cta}</div>
  <div class="hud"><div class="pbar"><i id="prog"></i></div></div>
  <div class="grain"></div>
</div>
<script>
const SCENES = ${JSON.stringify(scenes)};
const TOTAL = ${total};
// 씬 전환 = 옆으로 빠르게 미는 슬라이드(0.26초).
// 크로스페이드(흐려지며 사라졌다 다시 나타남)는 "제품 사진이 사라진다"고 읽혀
// 그 순간 스킵을 부른다 — 슬라이드는 이미지가 화면 밖으로 나가지 않고 이어진다.
const XF = 0.26;
const EASE = 'cubic-bezier(.16,1,.3,1)';
const BACK = 'cubic-bezier(.34,1.56,.64,1)';
const anims = [];
const hooks = [];

function add(el, kf, dur, delay, opt){
  opt = opt || {};
  const a = el.animate(kf, {
    duration: Math.max(1, dur*1000), delay: Math.max(0, delay)*1000,
    easing: opt.ease || EASE, fill: opt.fill || 'both',
    iterations: opt.iter || 1, direction: opt.dir || 'normal'
  });
  a.pause(); anims.push(a); return a;
}

const KIND = {
  rise: { dur:.78, kf:[{opacity:0,transform:'translateY(86px)',filter:'blur(12px)'},
                       {opacity:1,transform:'translateY(0px)',filter:'blur(0px)'}] },
  pop:  { dur:.70, ease:BACK, kf:[{opacity:0,transform:'scale(.35)'},
                                  {opacity:1,transform:'scale(1.08)',offset:.6},
                                  {opacity:1,transform:'scale(1)'}] },
  mask: { dur:.56, kf:[{opacity:0,clipPath:'inset(-15% 100% -25% 0)',transform:'translateY(24px)'},
                       {opacity:1,clipPath:'inset(-15% 0% -25% 0)',transform:'translateY(0px)'}] },
  img:  { dur:.95, kf:[{opacity:0,transform:'scale(.86) rotate(-3.5deg) translateY(46px)'},
                       {opacity:1,transform:'scale(1) rotate(0deg) translateY(0px)'}] },
  // 표지 전용 — 첫 프레임이 곧 릴스 썸네일이자 스크롤 스토퍼다.
  // 시작값을 충분히 진하게 둬서 0프레임에도 훅과 제품이 또렷이 읽히게 하고,
  // 움직임은 "이미 있던 것이 살짝 자리를 잡는" 정도만 남긴다.
  riseFast: { dur:.32, kf:[{opacity:.55,transform:'translateY(26px)',filter:'blur(3px)'},
                           {opacity:1,transform:'translateY(0px)',filter:'blur(0px)'}] },
  imgFast:  { dur:.42, kf:[{opacity:.6,transform:'scale(.978) rotate(-1deg) translateY(12px)'},
                           {opacity:1,transform:'scale(1) rotate(0deg) translateY(0px)'}] },
  bar:  { dur:.62, kf:[{transform:'scaleX(0)'},{transform:'scaleX(1)'}] },
  fade: { dur:.60, kf:[{opacity:0},{opacity:1}] }
};

const LOOP = {
  bob:   { dur:2.2, kf:[{transform:'translateY(0px)'},{transform:'translateY(-16px)'}] },
  bob2:  { dur:2.9, kf:[{transform:'translateY(0px) rotate(0deg)'},{transform:'translateY(-13px) rotate(7deg)'}] },
  pulse: { dur:1.1, kf:[{transform:'scale(1)'},{transform:'scale(1.10)'}] },
  nudge: { dur:.9,  kf:[{transform:'translateY(0px)'},{transform:'translateY(9px)'}] },
  drift: { dur:11,  kf:[{transform:'translate(0px,0px) scale(1)'},{transform:'translate(120px,90px) scale(1.18)'}] },
  drift2:{ dur:14,  kf:[{transform:'translate(0px,0px) scale(1.1)'},{transform:'translate(-110px,-80px) scale(1)'}] }
};

function delayOf(el, s){
  const own = parseFloat(el.dataset.delay || '0');
  const st = el.closest('[data-stagger]');
  if (st && st !== el){
    const kids = Array.prototype.slice.call(st.querySelectorAll('[data-anim]'));
    return s.start + parseFloat(st.dataset.delay || '0') + kids.indexOf(el) * parseFloat(st.dataset.stagger || '.05');
  }
  return s.start + own;
}

const sceneEls = document.querySelectorAll('.scene');
sceneEls.forEach(function(sc, i){
  const s = SCENES[i];
  const last = i === sceneEls.length - 1;

  // 씬 등장/퇴장 = 좌우 슬라이드. 두 씬이 같은 속도로 움직여 필름 스트립처럼 이어진다.
  // 첫 씬은 애니메이션 없이 처음부터 제자리(첫 프레임 빈 화면 방지).
  const SLIDE = 'cubic-bezier(.45,0,.15,1)';
  if (i > 0){
    add(sc, [{transform:'translateX(100%)'},{transform:'translateX(0%)'}], XF, s.start - XF, {ease:SLIDE});
  }
  if (!last){
    add(sc, [{transform:'translateX(0%)'},{transform:'translateX(-100%)'}], XF, s.end - XF,
        {fill:'forwards', ease:SLIDE});
  }

  // 켄번스 — 씬 전체 길이에 걸친 아주 느린 확대/축소
  sc.querySelectorAll('[data-ken]').forEach(function(el){
    const zin = el.dataset.ken === 'in';
    add(el, zin ? [{transform:'scale(1)'},{transform:'scale(1.075)'}]
                : [{transform:'scale(1.075)'},{transform:'scale(1)'}],
        (s.end - s.start) + XF, Math.max(0, s.start - XF), {ease:'linear'});
  });

  // 개별 요소 등장
  sc.querySelectorAll('[data-anim]').forEach(function(el){
    const k = KIND[el.dataset.anim];
    if (!k) return;
    add(el, k.kf, parseFloat(el.dataset.dur || k.dur), delayOf(el, s), {ease:k.ease});
  });

  // 가격 카운트업
  sc.querySelectorAll('[data-count-to]').forEach(function(el){
    const to = +el.dataset.countTo;
    const at = s.start + parseFloat(el.dataset.countDelay || '0');
    const dur = parseFloat(el.dataset.countDur || '0.8');
    hooks.push(function(t){
      const p = Math.max(0, Math.min(1, (t - at) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e).toLocaleString('ko-KR') + '원';
    });
  });
});

// 루프 모션(등장 애니메이션과 충돌하지 않도록 항상 별도 엘리먼트)
document.querySelectorAll('[data-loop]').forEach(function(el){
  const l = LOOP[el.dataset.loop];
  if (!l) return;
  add(el, l.kf, l.dur, 0, {iter:Infinity, dir:'alternate', ease:'ease-in-out'});
});

// 마스코트 눈 깜빡임 / 손 흔들기
document.querySelectorAll('.mascot .eye').forEach(function(el){
  add(el, [{transform:'scaleY(1)',offset:0},{transform:'scaleY(1)',offset:.93},
           {transform:'scaleY(.08)',offset:.955},{transform:'scaleY(1)',offset:.98},
           {transform:'scaleY(1)',offset:1}], 4.4, 0, {iter:Infinity, ease:'linear'});
});
document.querySelectorAll('.mascot .arm').forEach(function(el){
  add(el, [{transform:'rotate(-16deg)'},{transform:'rotate(14deg)'}], 0.62, 0,
      {iter:Infinity, dir:'alternate', ease:'ease-in-out'});
});

// 상단 진행바
const prog = document.getElementById('prog');
hooks.push(function(t){ prog.style.width = Math.min(100, t / TOTAL * 100) + '%'; });

window.__total = TOTAL;
window.__seek = function(ms){
  for (let i = 0; i < anims.length; i++) anims[i].currentTime = ms;
  const t = ms / 1000;
  for (let i = 0; i < hooks.length; i++) hooks[i](t);
};
window.__seek(0);
window.__ready = true;
</script></body></html>`;
}
