import test from "node:test";
import assert from "node:assert/strict";
import { validatePreferences } from "../src/preferences.js";

test("invalid stored shapes leave defaults intact", () => {
  for (const saved of [null, undefined, false, 42, "text", [], ["all"]]) {
    assert.deepEqual(validatePreferences(saved), {});
  }
});

test("valid preferences survive while invalid fields keep defaults", () => {
  const defaults = { row: "all", len: "all", timedMode: "off", jump: false };
  const saved = {
    row: 'invalid"]', len: "long", timedMode: "10min", jump: "false",
    display: "paragraph", strictKey: true, light: false,
    wordVoice: true, wordVoiceChoice: "com.apple.voice.Karen", extra: true,
  };
  assert.deepEqual({ ...defaults, ...validatePreferences(saved) }, {
    ...defaults, len: "long", display: "paragraph", strictKey: true,
    light: false, wordVoice: true, wordVoiceChoice: "com.apple.voice.Karen",
  });
});

test("legacy sound preference fills missing channels without overriding them", () => {
  assert.deepEqual(validatePreferences({ sound: false }), {
    soundKeys: false, soundFx: false,
  });
  assert.deepEqual(validatePreferences({ sound: true, soundKeys: false }), {
    soundKeys: false, soundFx: true,
  });
  assert.deepEqual(validatePreferences({ sound: "false", soundFx: 0 }), {});
});

test("empty voice choices and inherited preferences are ignored", () => {
  assert.deepEqual(validatePreferences({ wordVoiceChoice: "  " }), {});
  assert.deepEqual(validatePreferences(Object.create({ row: "top", jump: true })), {});
});
