import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateStages, normalizeCandidateStage, stageLabels } from '../lib/company-candidates';

test('hiring pipeline has four stages and rejection; legacy stages count as new', () => {
  assert.deepEqual(candidateStages, ['new', 'interview', 'offer', 'hired', 'rejected']);
  const read = ['new', 'review', 'shortlist', 'interview', 'offer', 'hired', 'rejected'].map(normalizeCandidateStage);
  assert.equal(read.filter((stage) => stage === 'new').length, 3);
  assert.deepEqual(read.map((stage) => stageLabels[stage]), ['ახალი', 'ახალი', 'ახალი', 'გასაუბრება', 'შეთავაზება', 'აყვანილი', 'უარი']);
});
