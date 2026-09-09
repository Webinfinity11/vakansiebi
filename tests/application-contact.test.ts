import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applicationContacts,
  mailtoAddress,
  emailDraft,
  hasEnglishDescription,
} from '../lib/application-contact';
import { cleanText } from '../worker/adapters';
void test('emails in recruitment instructions are visible and deduplicated', () => {
  const contacts = applicationContacts(
    'გთხოვთ გამოაგზავნოთ რეზიუმე jobs@example.com მისამართზე. Jobs@example.com',
  );
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].email, 'jobs@example.com');
  assert.equal(contacts[0].application, true);
  assert.equal(
    applicationContacts('Company contact: info@example.com')[0].application,
    false,
  );
  assert.equal(
    applicationContacts('For your application data privacy: dpo@example.com')[0]
      .application,
    false,
  );
});
void test('mailto recipients survive text extraction without importing hidden recipients or headers', () => {
  assert.equal(
    cleanText(
      '<p>Send your CV <a href="mailto:jobs%40example.com?bcc=hidden@example.com">here</a></p>',
    ),
    'Send your CV here jobs@example.com',
  );
  assert.equal(
    mailtoAddress('mailto:jobs@example.com%0D%0ABcc:evil@example.com'),
    null,
  );
  assert.equal(mailtoAddress('https://example.com'), null);
  assert.equal(mailtoAddress('mailto:a@example.com,b@example.com'), null);
});
void test('draft links encode all user-controlled fields and never contain an injected bcc parameter', () => {
  const link = emailDraft(
    'jobs@example.com',
    'Engineer\r\n&bcc=evil@example.com',
    'Hello &bcc=other@example.com',
  );
  const u = new URL(link);
  assert.equal(u.searchParams.get('bcc'), null);
  assert.equal(u.searchParams.get('body'), 'Hello &bcc=other@example.com');
  assert.ok(!u.searchParams.get('subject')!.includes('\n'));
  assert.throws(() => emailDraft('bad\n@example.com', 'title', 'body'));
});
void test('translation is offered for substantial English text, not an email in Georgian text', () => {
  assert.equal(
    hasEnglishDescription(
      'We are looking for an experienced developer to join our team and build reliable services. '.repeat(
        4,
      ),
    ),
    true,
  );
  assert.equal(
    hasEnglishDescription(
      'ვაცხადებთ ვაკანსიას, გამოაგზავნეთ რეზიუმე jobs@example.com',
    ),
    false,
  );
});
