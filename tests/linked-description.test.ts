import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHelio,
  parseLinkedPage,
  sameLinkedTitle,
  linkedProvider,
} from '../worker/linked-description';
import { validateLinkedUrl } from '../worker/public-page';
import { cleanText, parseDetail } from '../worker/adapters';
void test('linked employer description keeps all paragraphs, bullets, contacts and final requirements', () => {
  const text =
    '<p>პირველი აბზაცი კომპანიისა და სამუშაო ადგილის შესახებ.</p><h4>მოვალეობები:</h4><ul><li>პირველი მოვალეობა</li><li>მეორე მოვალეობა</li></ul><p>ხელფასი: 1700 ლარი თვეში</p><p>ბოლო მოთხოვნა: ინგლისური B2.</p>';
  const v = parseHelio(
    {
      public_url_token: 'abc',
      status: 'active',
      job_title_local: 'მოლარე თბილისში',
      description: text,
    },
    'abc',
    'https://app.helio-ai.com/apply/abc',
  );
  assert.match(v.text, /პირველი აბზაცი/);
  assert.match(v.text, /• მეორე მოვალეობა/);
  assert.ok(v.text.endsWith('ბოლო მოთხოვნა: ინგლისური B2.'));
  assert.throws(() =>
    parseHelio(
      { public_url_token: 'wrong', status: 'active', description: text },
      'abc',
      v.url,
    ),
  );
  assert.equal(sameLinkedTitle('მოლარე', 'მოლარე თბილისში'), true);
  assert.equal(sameLinkedTitle('მოლარე', 'გაყიდვების მენეჯერი'), false);
});
void test('only vacancy content is read from employer HTML; application inputs and navigation stay out', () => {
  const text =
    'ძირითადი სამუშაო პირობები და მოთხოვნები. '.repeat(5) + 'საბოლოო პირობა.';
  const v = parseLinkedPage(
    `<nav>Other jobs</nav><div class="pub-vac-text"><div class="vacancy_title_inner">მოლარე</div><div class="pub_vac_text_detail">${text}</div></div><form>Candidate email<input value="private"></form>`,
    'https://dailygroup.selfrecruit.ge/abc',
    'selfrecruit',
  );
  assert.equal(v.title, 'მოლარე');
  assert.equal(v.text, text);
  assert.doesNotMatch(v.text, /Candidate|Other jobs|private/);
  const smart = parseLinkedPage(
    `<h1 class="job-title">მოლარე</h1><section class="job-section">${text}</section><section class="job-section">დამატებითი საბოლოო პირობა.</section><form>CV</form>`,
    'https://jobs.smartrecruiters.com/company/123',
    'smart',
  );
  assert.ok(smart.text.endsWith('დამატებითი საბოლოო პირობა.'));
});
void test('employer URL allowlist rejects local addresses, credentials and lookalike hosts', () => {
  for (const url of [
    'https://127.0.0.1/',
    'https://hel-ai.com.evil.test/apply/abc',
    'https://x:y@hel-ai.com/apply/abc',
    'https://a.selfrecruit.ge.evil.test/',
  ])
    assert.throws(() => validateLinkedUrl(url));
  assert.equal(linkedProvider('https://hel-ai.com/apply/abc'), 'helio');
  assert.equal(linkedProvider('https://hel-ai.com/'), null);
});
void test('original public links and table values survive text extraction', () => {
  const result = cleanText(
    '<h4>გრაფიკი</h4><table><tr><td>ორშაბათი</td><td>10:00–18:00</td></tr></table><p>დეტალები <a href="https://example.org/terms">წესები</a></p>',
  );
  assert.match(result, /ორშაბათი \| 10:00–18:00/);
  assert.match(result, /წესები https:\/\/example.org\/terms/);
});
void test('government keeps previously unknown labelled sections and final full text', () => {
  const html =
    '<input id="ID" value="42"><dl id="regForm"><dt>პოზიციის დასახელება</dt><dd>სპეციალისტი</dd><dt>ორგანიზაცია</dt><dd>საჯარო სამსახური</dd><dt>დამატებით მოთხოვნილი დოკუმენტები</dt><dd>სერტიფიკატი და გამოცდილების დამადასტურებელი სრული დოკუმენტაცია</dd></dl>';
  const v = parseDetail(
    'hrgov',
    html,
    'https://vacancy.hr.gov.ge/JobProvider/UserOrgVaks/Details/42',
  );
  assert.match(v.description, /დამატებით მოთხოვნილი დოკუმენტები/);
  assert.ok(
    v.description.endsWith(
      'სერტიფიკატი და გამოცდილების დამადასტურებელი სრული დოკუმენტაცია',
    ),
  );
});
