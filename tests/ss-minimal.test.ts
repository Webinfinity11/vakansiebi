import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDetail } from '../worker/adapters';
import { publishable } from '../worker/automation';
import { assessVacancy } from '../worker/quality';
const url = 'https://jobs.ss.ge/ka/details/mimtani-88234426';
function html(
  description: string | null,
  status: number | undefined = 0,
  employer = 'შპს თილაქ',
  id = 88234426,
) {
  return `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { detailsInitData: { id, status, jobsDealType: 1, title: { ka: 'მიმტანი' }, publisherName: employer, description: { ka: description }, duties: null, requirements: null } } } })}</script>`;
}
void test('active verified SS listings can contain their genuine short description without padding', () => {
  const description = 'ჩინურ რესტორანში გვესაჭიროება მიმტანი';
  const v = parseDetail('ss', html(description), url);
  assert.equal(v.description, description);
  assert.ok(v.description.length < 40);
  assert.ok(publishable(v, 'ss', url));
});
void test('active verified SS listings with no source description retain an honest empty value and warning', () => {
  const v = parseDetail('ss', html(null), url);
  assert.equal(v.description, '');
  assert.ok(v.warnings?.some((w) => w.includes('აღწერა')));
  assert.ok(publishable(v, 'ss', url));
  assert.equal(assessVacancy(null, v).hold, false);
  assert.equal(
    assessVacancy(
      {
        ...v,
        description:
          'Detailed requirements and duties for the previous vacancy version. '.repeat(
            10,
          ),
      },
      v,
    ).hold,
    true,
  );
});
void test('minimal description exception requires active matching SS detail and employer; other sources remain strict', () => {
  assert.throws(() => parseDetail('ss', html(null, 1), url));
  assert.throws(() => parseDetail('ss', html(null, 0, ''), url));
  assert.throws(() => parseDetail('ss', html(null, 0, 'Acme', 99), url));
  const v = parseDetail('ss', html(null), url);
  assert.equal(
    publishable(
      { ...v, source: 'hr.ge', url: 'https://www.hr.ge/announcement/123/test' },
      'hr',
      'https://www.hr.ge/announcement/123/test',
    ),
    null,
  );
  assert.equal(
    publishable(
      { ...v, url: 'https://evil.test/ka/details/foo-123' },
      'ss',
      'https://evil.test/ka/details/foo-123',
    ),
    null,
  );
});
