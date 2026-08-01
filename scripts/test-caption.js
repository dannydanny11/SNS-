// 모듈 ④ 테스트: 선정 상품으로 캡션 생성 + 검증.
//   실행:  npm run test:caption
//   ANTHROPIC_API_KEY 가 .env 에 있어야 합니다.
import { selectProducts } from '../src/selectProducts.js';
import { generateCaption } from '../src/caption.js';
import { validateCaption } from '../src/validateCaption.js';

async function main() {
  console.log('\n상품 선정...');
  const { category, products } = await selectProducts();
  console.log(`카테고리: ${category.name}, 상품 ${products.length}개\n`);

  console.log('캡션 생성 중 (Claude API)...\n');
  const { caption, hashtags } = await generateCaption({ category, products });

  console.log('─'.repeat(50));
  console.log(caption);
  console.log('─'.repeat(50));

  const v = validateCaption(caption);
  console.log(`\n해시태그 ${hashtags.length}개`);
  console.log(v.ok ? '✅ 검증 통과 (발행 가능)' : `❌ 검증 실패: ${v.reason}`);
  console.log();
}

main().catch((err) => {
  console.error('\n❌ 실패:', err.message, '\n');
  process.exitCode = 1;
});
