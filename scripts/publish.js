// GitHub Actions 2단계: 매니페스트의 카드를 공개 URL 로 게시.
import { publish, readManifest } from '../src/pipeline.js';
import { notify } from '../src/notify.js';
import { postedTodayKST } from '../src/postedLog.js';

async function main() {
  // 오늘 이미 게시했으면 건너뜀 (생성 단계가 건너뛴 경우 stale 매니페스트 재게시 방지)
  if (process.env.FORCE !== '1' && postedTodayKST()) {
    console.log('오늘 이미 게시함 → 게시 건너뜀');
    return;
  }
  const manifest = readManifest();
  const names = manifest.products.map((p) => p.productName.split(',')[0]).join(', ');
  try {
    const res = await publish(manifest);
    const posted = [];
    if (res.carousel) posted.push(`캐러셀: ${res.carousel.permalink || res.carousel.postId}`);
    if (res.reel) posted.push(`릴스: ${res.reel.permalink || res.reel.postId}`);
    const linkList = (manifest.links || []).map((l) => `• ${l.name}\n${l.url}`).join('\n');
    await notify(
      `✅ atoztem 게시 완료 [${manifest.category.name}]\n${posted.join('\n')}\n\n📎 프로필 링크에 넣을 제휴 링크:\n${linkList}`
    );
  } catch (e) {
    await notify(`❌ atoztem 게시 실패 [${manifest.category.name}]\n${e.message}`);
    process.exitCode = 1;
  }
}

main();
