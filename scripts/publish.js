// GitHub Actions 2단계: 매니페스트의 카드를 공개 URL 로 게시.
import { publish, readManifest } from '../src/pipeline.js';
import { notify } from '../src/notify.js';

async function main() {
  const manifest = readManifest();
  const names = manifest.products.map((p) => p.productName.split(',')[0]).join(', ');
  try {
    const res = await publish(manifest);
    await notify(
      `✅ atoztem 게시 완료 [${manifest.category.name}]\n상품: ${names}\n${res.permalink || res.postId}`
    );
  } catch (e) {
    await notify(`❌ atoztem 게시 실패 [${manifest.category.name}]\n${e.message}`);
    process.exitCode = 1;
  }
}

main();
