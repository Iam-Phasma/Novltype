const CHOICES = {
  row: ["all", "top", "home", "bottom"],
  len: ["all", "short", "medium", "long"],
  timedMode: ["off", "30s", "1min", "2min", "3min", "5min"],
  display: ["word", "paragraph", "rise"],
};

const BOOLEANS = [
  "jump", "strictKey", "light", "soundKeys", "soundFx", "wordVoice",
];

// Return only valid overrides, leaving the app's defaults in place otherwise.
export function validatePreferences(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};

  const prefs = {};
  for (const [key, choices] of Object.entries(CHOICES)) {
    if (Object.hasOwn(saved, key) && choices.includes(saved[key])) {
      prefs[key] = saved[key];
    }
  }
  for (const key of BOOLEANS) {
    if (Object.hasOwn(saved, key) && typeof saved[key] === "boolean") {
      prefs[key] = saved[key];
    }
  }

  // Older versions stored one sound toggle for both channels.
  if (Object.hasOwn(saved, "sound") && typeof saved.sound === "boolean") {
    prefs.soundKeys ??= saved.sound;
    prefs.soundFx ??= saved.sound;
  }

  if (Object.hasOwn(saved, "wordVoiceChoice") &&
      typeof saved.wordVoiceChoice === "string" && saved.wordVoiceChoice.trim()) {
    prefs.wordVoiceChoice = saved.wordVoiceChoice;
  }
  return prefs;
}
