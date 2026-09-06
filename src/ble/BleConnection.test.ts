import { describe, expect, test } from 'bun:test';

import { decodeBase64, encodeBase64 } from './BleConnection';

describe('BLE Base64 transport encoding', () => {
  test.each([
    ['ASCII', 'Hello'],
    ['spaces', 'Hello world'],
    ['Japanese', 'こんにちは'],
    ['Hindi', 'नमस्ते'],
    ['Russian', 'Привет'],
    ['emoji', 'Hello 👋'],
    ['Arabic', 'مرحبا'],
    ['empty', ''],
  ])('%s round-trips as UTF-8', (_label: string, input: string) => {
    expect(decodeBase64(encodeBase64(input))).toBe(input);
  });

  test('matches the standard Base64 value for UTF-8 text', () => {
    expect(encodeBase64('こんにちは')).toBe('44GT44KT44Gr44Gh44Gv');
  });

  test('rejects malformed Base64', () => {
    expect(() => decodeBase64('not base64!')).toThrow('Invalid Base64 input');
  });
});