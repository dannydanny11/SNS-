// GitHub Actions 1단계: 이번 주 풀 확보 + 지금 밀린 슬롯(릴스/캐러셀) 렌더 → published/queue.json.
import { generateDue } from '../src/pipeline.js';
import { closeBrowser } from '../src/cards/render.js';
import { notify } from '../src/notify.js';

generateDue()
  .then(async (queue) => {
    await closeBrowser();
    const n = queue.items.length;
    if (n === 0) {
      console.log('이번엔 게시할 슬롯 없음(예정시각 전이거나 이미 완료).');
      return;
    }
    const summary = queue.items
      .map((it) => (it.type === 'reel' ? `릴스[${it.slot}] ${it.name}` : `캐러셀(5개)`))
      .join(', ');
    console.log(`생성 완료 — ${n}건: ${summary}`);
    await notify(`🧪 atoztem 생성 [${queue.weekKey}] — ${n}건\n${summary}`);
  })
  .catch(async (e) => {
    await closeBrowser();
    console.error('생성 실패:', e.message);
    process.exitCode = 1;
  });
