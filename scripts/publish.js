// GitHub Actions 2단계: 큐(published/queue.json)의 항목을 공개 URL 로 게시 + 풀 상태 갱신.
import { publishDue } from '../src/pipeline.js';
import { notify } from '../src/notify.js';

async function main() {
  const { posted } = await publishDue();
  if (posted.length === 0) {
    console.log('게시할 항목 없음.');
    return;
  }
  const ok = posted.filter((p) => !p.error);
  const fail = posted.filter((p) => p.error);
  const lines = ok.map((p) =>
    p.type === 'reel'
      ? `릴스[${p.slot}] ${p.name}: ${p.permalink || p.postId}`
      : `캐러셀: ${p.permalink || p.postId}`
  );
  if (ok.length) await notify(`✅ atoztem 게시 완료 (${ok.length}건)\n${lines.join('\n')}`);
  if (fail.length) {
    await notify(`❌ atoztem 일부 게시 실패\n${fail.map((f) => `${f.type}: ${f.error}`).join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch(async (e) => {
  await notify(`❌ atoztem 게시 단계 오류\n${e.message}`);
  process.exitCode = 1;
});
