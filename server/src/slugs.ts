import { randomInt } from 'node:crypto';

const ADJECTIVES = [
  'tiny', 'bold', 'calm', 'brave', 'bright', 'clever', 'crisp', 'curly', 'dusty', 'eager',
  'early', 'faint', 'fancy', 'fast', 'fierce', 'fresh', 'fuzzy', 'gentle', 'giant', 'glad',
  'golden', 'green', 'happy', 'hazy', 'humble', 'icy', 'jolly', 'keen', 'kind', 'late',
  'lazy', 'light', 'lively', 'lonely', 'loud', 'lucky', 'lunar', 'mellow', 'merry', 'mild',
  'misty', 'neat', 'noble', 'odd', 'pale', 'plain', 'polar', 'proud', 'quick', 'quiet',
  'rapid', 'rare', 'rosy', 'rough', 'round', 'royal', 'rusty', 'sandy', 'sharp', 'shiny',
  'silent', 'silver', 'sleepy', 'slim', 'small', 'smooth', 'snowy', 'soft', 'solar', 'solid',
  'spare', 'spry', 'steep', 'still', 'stormy', 'sunny', 'sweet', 'swift', 'tall', 'tame',
  'vivid', 'warm', 'wavy', 'wild', 'windy', 'wise', 'witty', 'young', 'zesty', 'zippy'
];

const NOUNS = [
  'snow', 'river', 'fox', 'acorn', 'aspen', 'badger', 'bay', 'beach', 'bear', 'bird',
  'birch', 'bloom', 'brook', 'canyon', 'cedar', 'cliff', 'cloud', 'coast', 'coral', 'crane',
  'creek', 'crow', 'dawn', 'deer', 'delta', 'dune', 'dusk', 'elm', 'ember', 'falcon',
  'fern', 'field', 'finch', 'fjord', 'flint', 'fog', 'forest', 'frost', 'glade', 'grove',
  'hare', 'hawk', 'heron', 'hill', 'ice', 'iris', 'lake', 'lark', 'leaf', 'lily',
  'lynx', 'maple', 'marsh', 'meadow', 'moon', 'moss', 'moth', 'newt', 'oak', 'ocean',
  'otter', 'owl', 'peak', 'pebble', 'pine', 'plume', 'pond', 'quail', 'rain', 'reed',
  'ridge', 'robin', 'rock', 'seal', 'shore', 'sky', 'sparrow', 'spring', 'star', 'stone',
  'storm', 'swan', 'thorn', 'tide', 'trail', 'vale', 'wave', 'willow', 'wolf', 'wren'
];

/** Accepts both current slugs (6-char random suffix) and legacy 2-digit ones. */
export const SLUG_PATTERN = /^[a-z]+-[a-z]+-[a-z0-9]{2,12}$/;

const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SUFFIX_LENGTH = 6;

/**
 * Random readable slug like `tiny-snow-k4d92h`, chosen with a CSPRNG.
 * Words keep it friendly; the 6-char base-36 suffix (~44 bits combined)
 * makes live URLs impractical to find by scanning.
 */
export function newSlug(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  return `${adjective}-${noun}-${suffix}`;
}
