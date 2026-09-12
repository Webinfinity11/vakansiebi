import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applicationContacts,
  mailtoAddress,
  emailDraft,
  hasEnglishDescription,
  applicationBody,
} from '../lib/application-contact';
import { defaultApplicationBody } from '../lib/vacancy-details';
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
void test('a letter carries the saved details and is left untouched when there are none', () => {
  assert.equal(
    applicationBody(defaultApplicationBody, null),
    defaultApplicationBody,
  );
  assert.equal(
    applicationBody(defaultApplicationBody, {
      fullName: '',
      phone: '',
      email: '',
    }),
    defaultApplicationBody,
  );
  const full = applicationBody(defaultApplicationBody, {
    fullName: 'ნინო ბერიძე',
    phone: '+995 555 12 34 56',
    email: 'nino@example.com',
  });
  assert.equal(full.includes('[შენი სახელი]'), false);
  /* The signature already carries the name, so the contact block below it adds only the ways
     to reach the person back. */
  assert.equal(full.includes('სახელი: ნინო ბერიძე'), false);
  assert.ok(full.includes('ნინო ბერიძე'));
  assert.equal(
    full.endsWith('\n\nტელეფონი: +995 555 12 34 56\nელფოსტა: nino@example.com'),
    true,
  );
  /* A letter with no placeholder to sign is a different case: there the name has to be stated
     or it is nowhere at all. */
  const unsigned = applicationBody('გამარჯობა,\n\nკითხვა მაქვს.', {
    fullName: 'ნინო ბერიძე',
    phone: '',
    email: '',
  });
  assert.ok(unsigned.endsWith('\n\nსახელი: ნინო ბერიძე'));
  // Only what was filled in appears; the placeholder stays when no name was given.
  const partial = applicationBody(defaultApplicationBody, {
    fullName: '',
    phone: '',
    email: 'nino@example.com',
  });
  assert.equal(partial.includes('[შენი სახელი]'), true);
  assert.equal(partial.endsWith('\n\nელფოსტა: nino@example.com'), true);
});
