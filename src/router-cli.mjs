import {routeQuestion} from './evidence-router.mjs';
const [root='fixtures/ax_multi_doc_v0',...tokens]=process.argv.slice(2);
const question=tokens.join(' ')||'총 매출과 반품 기간, 배송 준비 기간은?';
try {
  const result=routeQuestion(root,question);
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if(result.status!=='ANSWERED')process.exitCode=2;
}catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;}
