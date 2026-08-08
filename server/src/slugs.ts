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

export const SLUG_PATTERN = /^[a-z]+-[a-z]+-\d{2}$/;

/** Random readable slug like `tiny-snow-27`, chosen with a CSPRNG. */
export function newSlug(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const number = String(randomInt(100)).padStart(2, '0');
  return `${adjective}-${noun}-${number}`;
}
