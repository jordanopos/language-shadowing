// Shared (client + server) definitions for Speak & Improve correction metadata.
// Kept separate from anything used by the shadowing feature.

export const CATEGORIES = [
  'Grammar Error',
  'Verb Tense or Conjugation',
  'Agreement',
  'Preposition or Article',
  'Vocabulary',
  'Unnatural Expression',
  'English Code-Switching',
  'Style Improvement',
  'Clarity or Sentence Structure',
];

export const CORRECTION_TYPES = ['error', 'improvement', 'optional'];
export const SEVERITIES = ['low', 'medium', 'high'];
export const VOCAB_CATEGORIES = ['connector', 'idiom', 'expression', 'verb', 'noun', 'adjective', 'adverb', 'other'];

// Colour "tone" per category. Tones map to accessible colour pairs in speak.css:
//   grammar → red, vocab → orange, natural → purple, style → blue.
const TONE_BY_CATEGORY = {
  'Grammar Error': 'grammar',
  'Verb Tense or Conjugation': 'grammar',
  'Agreement': 'grammar',
  'Preposition or Article': 'grammar',
  'Vocabulary': 'vocab',
  'English Code-Switching': 'vocab',
  'Unnatural Expression': 'natural',
  'Clarity or Sentence Structure': 'natural',
  'Style Improvement': 'style',
};

export function toneFor(correction) {
  if (correction?.type === 'optional') return 'style';
  return TONE_BY_CATEGORY[correction?.category] || 'style';
}

export const TONE_LABELS = {
  grammar: 'Grammar',
  vocab: 'Vocabulary',
  natural: 'Naturalness',
  style: 'Optional / style',
};

export const TYPE_LABELS = {
  error: 'Error',
  improvement: 'More natural',
  optional: 'Optional',
};

// Filters shown on the analysis page. `match` decides which corrections are emphasised.
export const FILTERS = [
  { id: 'all', label: 'All corrections', match: () => true },
  { id: 'grammar', label: 'Grammar', match: c => ['Grammar Error', 'Agreement', 'Preposition or Article'].includes(c.category) },
  { id: 'tense', label: 'Verb tenses', match: c => c.category === 'Verb Tense or Conjugation' },
  { id: 'vocab', label: 'Vocabulary', match: c => ['Vocabulary', 'English Code-Switching'].includes(c.category) },
  { id: 'natural', label: 'Naturalness', match: c => ['Unnatural Expression', 'Clarity or Sentence Structure'].includes(c.category) },
  { id: 'style', label: 'Style', match: c => c.category === 'Style Improvement' || c.type === 'optional' },
];

export const SPEAK_LIMITS = {
  maxAudioBytes: 25 * 1024 * 1024,
  maxTextChars: 8000,
  maxRecordingSeconds: 10 * 60,
  audioExtensions: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'flac', 'ogg', 'oga'],
};
