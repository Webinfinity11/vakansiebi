import test from 'node:test';
import assert from 'node:assert/strict';

// The current date is explicit so these checks keep working across New Year.
test('Georgian until labels cover every month and only add a different year', async () => {
  const { formatUntil, visibleJobDeadline } = await import('../lib/company-job-form');
  const months = ['იანვრამდე', 'თებერვლამდე', 'მარტამდე', 'აპრილამდე', 'მაისამდე', 'ივნისამდე', 'ივლისამდე', 'აგვისტომდე', 'სექტემბრამდე', 'ოქტომბრამდე', 'ნოემბრამდე', 'დეკემბრამდე'];
  for (const [index, month] of months.entries()) {
    assert.equal(formatUntil(`2026-${String(index + 1).padStart(2, '0')}-26`, '2026-01-01'), `26 ${month}`);
  }
  assert.equal(formatUntil('2027-01-02', '2026-12-31'), '2027 წლის 2 იანვრამდე');
  assert.equal(visibleJobDeadline('2026-11-25', '2026-11-26'), '');
  assert.equal(visibleJobDeadline('2026-11-26', '2026-11-26'), '26 ნოემბრამდე');
  for (const invalid of ['', '2026-02-30', '2026-13-01', 'bad']) assert.equal(formatUntil(invalid, '2026-01-01'), '');
});

test('past edit deadline stays hidden while new, copy and reopen show their reset date', async () => {
  const { newCompanyJob, prepareCompanyJob, visibleJobDeadline } = await import('../lib/company-job-form');
  const today = '2026-11-26';
  const form = { ...newCompanyJob(), deadline: '2026-10-01' };
  assert.equal(visibleJobDeadline(prepareCompanyJob(form, { editing: true, today }).deadline, today), '');
  for (const options of [{}, { editing: false }, { editing: true, reopening: true }]) {
    assert.equal(visibleJobDeadline(prepareCompanyJob(form, { ...options, today }).deadline, today), '26 დეკემბრამდე');
  }
});
