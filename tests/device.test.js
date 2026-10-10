import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccessBlockReason } from '../src/device.js';

test('phones and tablets stay blocked at desktop viewport widths', () => {
  for (const device of [
    { userAgent: 'iPhone', platform: 'iPhone' },
    { userAgent: 'iPad', platform: 'iPad' },
    { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 },
    { userAgent: 'Linux; Android 14', platform: 'Linux armv8l' },
    { userAgent: 'Kindle Silk', platform: 'Linux' },
    { userAgentData: { mobile: true, platform: 'Unknown' } },
  ]) assert.equal(getAccessBlockReason(device, 1366), 'device');
});

test('desktop touchscreens remain supported and narrow windows are distinguished', () => {
  for (const device of [
    { platform: 'Win32', userAgent: 'Windows', maxTouchPoints: 10 },
    { platform: 'MacIntel', userAgent: 'Macintosh', maxTouchPoints: 0 },
    { platform: 'Linux x86_64', userAgent: 'Linux' },
  ]) {
    assert.equal(getAccessBlockReason(device, 701), null);
    assert.equal(getAccessBlockReason(device, 700), 'window');
  }
});
