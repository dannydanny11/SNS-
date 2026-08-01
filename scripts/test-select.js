// 모듈 ① 테스트: 오늘의 카테고리 선택 + 상품 5개 선정.
//   실행:  npm run test:select
import { selectProducts, pickCategory } from '../src/selectProducts.js';

function won(n) {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : n;
}

async function main() {
  const cat = pickCategory();
  console.log(`\n오늘의 카테고리: ${cat.name} (수수료 tier: ${cat.tier})\n`);

  const { products } = await selectProducts();

  if (products.length === 0) {
    console.log('⚠ 선정된 상품이 없습니다.');
    return;
  }

  console.log(`선정된 상품 ${products.length}개:`);
  products.forEach((p, i) => {
    console.log(
      `  ${i + 1}. [${p._keyword}] ${p.productName}\n     ${won(p.productPrice)} | 로켓 ${p.isRocket ? 'O' : 'X'} | 점수 ${p._score} | ID ${p.productId}`
    );
  });
  console.log('\n✅ 모듈 ① 정상 동작 확인 완료.\n');
}

main().catch((err) => {
  console.error('\n❌ 실패:', err.message, '\n');
  process.exitCode = 1;
});
