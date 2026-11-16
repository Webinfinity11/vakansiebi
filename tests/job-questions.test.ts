import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerQuestions,
  jobQuestionsSchema,
  requirementsMatch,
  type JobQuestion,
} from '../lib/job-questions';
const yes: JobQuestion = {
  id: '00000000-0000-4000-8000-000000000001',
  text: 'შეგიძლია შაბათს მუშაობა?',
  kind: 'yes_no',
  options: [],
  preferred: 'კი',
};
const text: JobQuestion = {
  ...yes,
  id: '00000000-0000-4000-8000-000000000002',
  text: 'რომელი პროგრამა იცი?',
  kind: 'text',
  preferred: '',
};
test('zero to five questions; invalid choices and preferred answers are rejected', () => {
  assert.deepEqual(jobQuestionsSchema.parse([]), []);
  assert.throws(() => jobQuestionsSchema.parse(Array(6).fill(yes)));
  assert.throws(() =>
    jobQuestionsSchema.parse([{ ...yes, kind: 'choice', options: ['ერთი'] }]),
  );
  assert.throws(() =>
    jobQuestionsSchema.parse([
      { ...yes, kind: 'choice', options: ['ერთი', 'ერთი'] },
    ]),
  );
  assert.throws(() =>
    jobQuestionsSchema.parse([{ ...yes, preferred: 'სხვა' }]),
  );
});
test('answers are validated and frozen with question text and preferred answer', () => {
  assert.throws(() => answerQuestions([yes], {}));
  assert.throws(() => answerQuestions([yes], { [yes.id]: 'სხვა' }));
  assert.throws(() =>
    answerQuestions([yes], { [yes.id]: 'კი', obsolete: 'კი' }),
  );
  const answers = answerQuestions([yes, text], {
    [yes.id]: 'არა',
    [text.id]: 'Excel',
  });
  assert.equal(answers[0].matches, false);
  assert.equal(answers[1].matches, null);
  yes.text = 'შეცვლილი კითხვა';
  assert.equal(answers[0].question, 'შეგიძლია შაბათს მუშაობა?');
  assert.equal(requirementsMatch(answers), false);
});
test('no preferred answers means no match badge; all preferred answers must match', () => {
  assert.equal(requirementsMatch([]), null);
  assert.equal(
    requirementsMatch(answerQuestions([text], { [text.id]: 'Word' })),
    null,
  );
  assert.equal(
    requirementsMatch(
      answerQuestions([yes, text], { [yes.id]: 'კი', [text.id]: 'Word' }),
    ),
    true,
  );
});
