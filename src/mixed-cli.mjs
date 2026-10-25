import { answerMixedQuestion } from './mixed-question.mjs';
const [root = 'fixtures/ax_sample_v0', ...words] = process.argv.slice(2);
const question = words.join(' ') || '총 매출과 반품 규정을 알려줘';
try {
  const result = answerMixedQuestion(root, question);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.status !== 'ANSWERED') process.exitCode = 2;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
