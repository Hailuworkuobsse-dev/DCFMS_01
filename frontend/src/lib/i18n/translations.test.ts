import test from 'node:test';
import assert from 'node:assert/strict';
import { amTranslations } from './am';
import { enTranslations } from './en';

function compareTranslationKeys(expected: unknown, actual: unknown, path = ''): void {
  assert.equal(typeof actual, typeof expected, `Translation type mismatch at ${path || 'root'}`);
  if (expected && typeof expected === 'object') {
    assert.deepEqual(
      Object.keys(actual as object).sort(),
      Object.keys(expected as object).sort(),
      `Translation keys differ at ${path || 'root'}`
    );
    for (const [key, value] of Object.entries(expected)) {
      compareTranslationKeys(value, (actual as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
    }
    return;
  }
  assert.equal(typeof actual, 'string', `Translation must be text at ${path}`);
  assert.ok((actual as string).trim().length > 0, `Translation must not be empty at ${path}`);
}

test('Amharic translations cover every English string without empty entries', () => {
  compareTranslationKeys(enTranslations, amTranslations);
});
