// GitHub Actions 1단계: 카드+캡션 생성 → out/latest-manifest.json.
import { generate } from '../src/pipeline.js';
import { closeBrowser } from '../src/cards/render.js';
import { notify } from '../src/notify.js';

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
