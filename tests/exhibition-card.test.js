import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/exhibition-card.js', import.meta.url), 'utf8');
const window = { location: { href: 'https://artgalzim.com/exhibitions.html' } };
vm.runInNewContext(source, { window, URL, URLSearchParams });
const render = window.ExhibitionCardRenderer.render;

test('exhibition WhatsApp action routes to the saved number with optional instructions', () => {
  const html = render({
    title: 'Open Call',
    actionType: 'whatsapp',
    whatsappNumber: '+263 77 123 4567',
    actionInstructions: 'Send your portfolio and a short bio.'
  });

  assert.match(html, /href="https:\/\/wa\.me\/263771234567\?text=Send%20your%20portfolio%20and%20a%20short%20bio\./);
  assert.match(html, /Booking \/ submission instructions/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test('exhibition email action routes to saved email and carries title and instructions', () => {
  const html = render({
    title: 'Emerging Artists Open Call',
    actionType: 'email',
    bookingEmail: 'submissions@example.org',
    actionInstructions: 'Attach up to five images.'
  });

  assert.match(html, /href="mailto:submissions@example\.org\?subject=Enquiry%3A\+Emerging\+Artists\+Open\+Call&amp;body=Attach\+up\+to\+five\+images\./);
  assert.match(html, />Send Portfolio \/ Email<\/a>/);
});

test('legacy links remain supported and invalid configured destinations hide the action', () => {
  const legacy = render({ title: 'Legacy event', registrationLink: 'https://forms.example.org/apply' });
  const invalidPhone = render({ title: 'Bad number', actionType: 'whatsapp', whatsappNumber: '123' });
  const invalidEmail = render({ title: 'Bad email', actionType: 'email', bookingEmail: 'not-an-email' });
  const disabled = render({ title: 'No action', actionType: 'none', registrationLink: 'https://forms.example.org/apply' });

  assert.match(legacy, /href="https:\/\/forms\.example\.org\/apply"/);
  assert.doesNotMatch(invalidPhone, /class="exh-cta"/);
  assert.doesNotMatch(invalidEmail, /class="exh-cta"/);
  assert.doesNotMatch(disabled, /class="exh-cta"/);
});