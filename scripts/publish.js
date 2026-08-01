// GitHub Actions 2단계: 매니페스트의 카드를 공개 URL 로 게시.
import { publish, readManifest } from '../src/pipeline.js';
import { notify } from '../src/notify.js';

async function main() {
  const manifest = readManifest();
  const names = manifest.products.map((p) => p.productName.split(',')[0]).join(', ');
  try {
    const res = await publish(manifest);
    const linkList = (manifest.links || []).map((l) => `• ${l.name}\n${l.url}`).join('\n');
    await notify(
      `✅ atoztem 게시 완료 [${manifest.category.name}]\n${res.permalink || res.postId}\n\n📎 프로필 링크에 넣을 제휴 링크:\n${linkList}`
    );
  } catch (e) {
    await notify(`❌ atoztem 게시 실패 [${manifest.category.name}]\n${e.message}`);
    process.exitCode = 1;
  }
}

main();
