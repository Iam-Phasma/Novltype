// All shared DOM element references — imported by any module that needs them.

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T | null;
}

export const $display = byId<HTMLDivElement>("word-display");
export const $hint = byId<HTMLDivElement>("hint");
export const $typer = byId<HTMLInputElement>("typer");
export const $wpm = byId<HTMLElement>("stat-wpm");
export const $acc = byId<HTMLElement>("stat-acc");
export const $time = byId<HTMLElement>("stat-time");
export const $words = byId<HTMLElement>("stat-words");
export const $btnSound = byId<HTMLButtonElement>("btn-sound");
export const $btnSoundFx = byId<HTMLButtonElement>("btn-sound-fx");
export const $btnSoundTest = byId<HTMLButtonElement>("btn-sound-test");
export const $btnStrictKey = byId<HTMLButtonElement>("btn-strict-key");
export const $btnVoice = byId<HTMLButtonElement>("btn-voice");
export const $selVoice = byId<HTMLSelectElement>("sel-voice");
export const $btnTheme = byId<HTMLButtonElement>("btn-theme");
export const $btnSettings = byId<HTMLButtonElement>("btn-settings");
export const $settingsPanel = byId<HTMLDivElement>("settings-panel");
export const $escHint = byId<HTMLDivElement>("esc-hint");
export const $bgOrbs = byId<HTMLDivElement>("bg-orbs");
export const $tip = byId<HTMLDivElement>("tip");
export const $app = byId<HTMLDivElement>("app");
export const $statsBar = document.querySelector(".stats-bar") as HTMLDivElement | null;
