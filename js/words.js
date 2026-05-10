"use strict";

// ══════════════════════════════════════════════════════════════════════
//  WORD LIST
// ══════════════════════════════════════════════════════════════════════

const WORDS = [
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
  "great",
  "between",
  "need",
  "large",
  "often",
  "hand",
  "high",
  "place",
  "hold",
  "turn",
  "during",
  "without",
  "before",
  "around",
  "school",
  "still",
  "learn",
  "plant",
  "cover",
  "food",
  "sun",
  "four",
  "state",
  "keep",
  "never",
  "last",
  "let",
  "thought",
  "city",
  "tree",
  "cross",
  "farm",
  "hard",
  "start",
  "might",
  "story",
  "saw",
  "far",
  "sea",
  "draw",
  "left",
  "late",
  "run",
  "while",
  "press",
  "close",
  "night",
  "real",
  "life",
  "few",
  "open",
  "seem",
  "together",
  "next",
  "white",
  "children",
  "begin",
  "got",
  "walk",
  "example",
  "ease",
  "paper",
  "group",
  "always",
  "music",
  "those",
  "both",
  "mark",
  "letter",
  "until",
  "mile",
  "river",
  "car",
  "feet",
  "care",
  "second",
  "book",
  "carry",
  "took",
  "science",
  "eat",
  "room",
  "friend",
  "began",
  "idea",
  "fish",
  "mountain",
  "stop",
  "once",
  "base",
  "hear",
  "horse",
  "cut",
  "sure",
  "watch",
  "color",
  "face",
  "wood",
  "main",
  "enough",
  "plain",
  "girl",
  "usual",
  "young",
  "ready",
  "above",
  "ever",
  "red",
  "list",
  "though",
  "feel",
  "talk",
  "bird",
  "soon",
  "body",
  "dog",
  "family",
  "direct",
  "pose",
  "leave",
  "song",
  "measure",
  "door",
  "product",
  "black",
  "short",
  "numeral",
  "class",
  "wind",
  "question",
  "happen",
  "complete",
  "ship",
  "area",
  "half",
  "rock",
  "order",
  "fire",
  "south",
  "piece",
  "told",
  "knew",
  "pass",
  "since",
  "top",
  "whole",
  "king",
  "space",
  "heard",
  "best",
  "hour",
  "better",
  "true",
  "hundred",
  "five",
  "remember",
  "step",
  "early",
  "west",
  "ground",
  "interest",
  "reach",
  "fast",
  "verb",
  "sing",
  "listen",
  "six",
  "table",
  "travel",
  "less",
  "morning",
  "ten",
  "simple",
  "several",
  "vowel",
  "toward",
  "war",
  "lay",
  "against",
  "pattern",
  "slow",
  "center",
  "love",
  "person",
  "money",
  "serve",
  "appear",
  "road",
  "map",
  "rain",
  "rule",
  "govern",
  "pull",
  "cold",
  "notice",
  "voice",
  "power",
  "town",
  "fine",
  "drive",
  "lead",
  "cry",
  "dark",
  "machine",
  "note",
  "wait",
  "plan",
  "figure",
  "star",
  "box",
  "noun",
  "field",
  "rest",
  "correct",
  "able",
  "pound",
  "done",
  "beauty",
  "stood",
  "contain",
  "front",
  "teach",
  "week",
  "final",
  "gave",
  "green",
  "oh",
  "quick",
  "develop",
  "ocean",
  "warm",
  "free",
  "minute",
  "strong",
  "special",
  "mind",
  "behind",
  "clear",
  "tail",
  "produce",
  "fact",
  "street",
  "inch",
  "multiply",
  "nothing",
  "course",
  "stay",
  "wheel",
  "full",
];

// ── Keyboard row membership ────────────────────────────────────────────

const ROW_KEYS = {
  top: new Set("qwertyuiop".split("")),
  home: new Set("asdfghjkl".split("")),
  bottom: new Set("zxcvbnm".split("")),
};

function rowScore(word, rowSet) {
  const letters = word
    .toLowerCase()
    .split("")
    .filter((c) => /[a-z]/.test(c));
  if (!letters.length) return 0;
  return letters.filter((c) => rowSet.has(c)).length / letters.length;
}

// ── Word pool helpers ──────────────────────────────────────────────────

function getPool() {
  let pool =
    _apiPool && _apiPool.length > 100
      ? _apiPool
      : WORDS.filter((w) => w.length >= 3);

  if (F.row !== "all") {
    const rs = ROW_KEYS[F.row];
    const filtered = pool.filter((w) => rowScore(w, rs) >= 0.5);
    if (filtered.length >= 20) pool = filtered;
  }

  if (F.len !== "all") {
    const ranges = { short: [3, 4], medium: [5, 7], long: [8, 14] };
    const [min, max] = ranges[F.len];
    const lpool = pool.filter((w) => w.length >= min && w.length <= max);
    if (lpool.length >= 20) pool = lpool;
  }

  return pool;
}

// ── Remote word pool (Google 10k, no swears) ──────────────────────────

const WORDS_API_URL =
  "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt";

let _apiPool = null;

async function fetchWordPool() {
  try {
    const resp = await fetch(WORDS_API_URL);
    const text = await resp.text();
    _apiPool = text
      .split("\n")
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]{3,14}$/.test(w));
    rebuildQueue();
  } catch {
    _apiPool = [];
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let queue = shuffle(WORDS);
let queueI = 0;

function rebuildQueue() {
  queue = shuffle(getPool());
  queueI = 0;
}

function nextWord() {
  if (queueI >= queue.length) rebuildQueue();
  return queue[queueI++];
}
