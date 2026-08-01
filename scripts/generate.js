// GitHub Actions 1단계: 카드+캡션 생성 → out/latest-manifest.json.
import { generate } from '../src/pipeline.js';
import { closeBrowser } from '../src/cards/render.js';

generate()
  .then(async (m) => {
    await closeBrowser();
    console.log(`생성 완료: ${m.category.name}, 카드 ${m.cardFiles.length}장, runId ${m.runId}`);
  })
  .catch(async (e) => {
    await closeBrowser();
    console.error('생성 실패:', e.message);
    process.exitCode = 1;
  });
