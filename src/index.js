// 로컬 통합 실행기.
//   DRY_RUN=1  → 카드+캡션 생성까지만 (게시 안 함). 로컬 테스트용.
//   그 외      → generate 후 곧바로 publish (IMAGE_BASE_URL 필요).
//
// 운영 규칙: 실패 시 1회 재시도 후 통지하고 종료(무한 재시도 금지).
import { generate, publish } from './pipeline.js';
import { closeBrowser } from './cards/render.js';
import { notify } from './notify.js';
import { optionalEnv } from './config.js';

const DRY_RUN = optionalEnv('DRY_RUN') === '1';

async function runOnce() {
  const manifest = await generate();
  if (DRY_RUN) return { dryRun: true, manifest };
  const res = await publish(manifest);
  return { dryRun: false, manifest, ...res };
}

async function main() {
  let result;
  try {
    result = await runOnce();
  } catch (e1) {
    console.warn('1차 실패:', e1.message, '— 1회 재시도');
    try {
      result = await runOnce();
    } catch (e2) {
      await closeBrowser();
      await notify(`❌ atoztem 파이프라인 실패 (재시도 후)\n${e2.message}`);
      process.exitCode = 1;
      return;
    }
  }

  await closeBrowser();
  const m = result.manifest;
  const names = m.products.map((p) => p.productName.split(',')[0]).join(', ');

  if (result.dryRun) {
    await notify(
      `🧪 DRY_RUN 완료 [${m.category.name}]\n상품: ${names}\n카드 ${m.cardFiles.length}장\n\n${m.caption}`
    );
  } else {
    const posted = [];
    if (result.carousel) posted.push(`캐러셀: ${result.carousel.permalink || result.carousel.postId}`);
    if (result.reel) posted.push(`릴스: ${result.reel.permalink || result.reel.postId}`);
    await notify(
      `✅ atoztem 게시 완료 [${m.category.name}]\n상품: ${names}\n${posted.join('\n')}`
    );
  }
}

main();
