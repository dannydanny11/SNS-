// GitHub Actions 1단계: 카드+캡션 생성 → out/latest-manifest.json.
import { generate } from '../src/pipeline.js';
import { closeBrowser } from '../src/cards/render.js';
import { notify } from '../src/notify.js';
import { postedTodayKST } from '../src/postedLog.js';

// 오늘 이미 게시했으면 건너뜀 (여러 번 예약해도 중복 안 되게). FORCE=1 이면 무시.
if (process.env.FORCE !== '1' && postedTodayKST()) {
  console.log('오늘 이미 게시함 → 이번 회차 건너뜀');
  process.exit(0);
}

generate()
  .then(async (m) => {
    await closeBrowser();
    console.log(`생성 완료: ${m.category.name}, 카드 ${m.cardFiles.length}장, runId ${m.runId}`);
    const linkList = m.links.map((l) => `• ${l.name}\n${l.url}`).join('\n');
    await notify(
      `🧪 생성 완료 [${m.category.name}] — 카드 ${m.cardFiles.length}장\n\n📎 프로필 링크에 넣을 제휴 링크:\n${linkList}`
    );
  })
  .catch(async (e) => {
    await closeBrowser();
    console.error('생성 실패:', e.message);
    process.exitCode = 1;
  });
