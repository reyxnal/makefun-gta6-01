// Chatter: the in-world social feed. Posts react to what the player
// actually does — witnessed crimes, escapes, missions, kindness — plus
// ambient city chatter so the feed feels alive between events.

import { PEOPLE_NAMES, FEED_HANDLES } from './config.js';
import { pick, rangeInt } from './rng.js';

const AMBIENT = [
  ['traffic', 'Traffic on Sol Avenue is a parking lot again. Someone parked a Burro across two lanes.'],
  ['food', 'Best fish tacos in Verdeluz and it is not even close. The cart by the marina, trust me.'],
  ['gulls', 'Saw the Gulls hanging around the docks again. Councilman Vane\'s boys, everyone knows it.'],
  ['weather', 'That golden hour light over the marina never gets old. Verdeluz, you beautiful mess.'],
  ['vane', 'Vane Tower lit up all night again. What is he building in there, a second city hall?'],
  ['radio', 'SOL FM playing the good stuff tonight. Windows down, volume up.'],
  ['beach', 'Beach day. The water is perfect and the gulls are stealing fries as usual.'],
  ['park', 'Verde Park at dawn is the only quiet place left in this city.'],
  ['cars', 'Someone left a Falco unlocked on Neon Row. In THIS economy? Bold.'],
  ['cops', 'Patrols doubled near the courthouse. Something big is brewing.'],
  ['rosa', 'Rosa\'s Garage fixed my bumper in twenty minutes and charged me fairly. Legend.'],
  ['night', 'Neon Row after midnight is a whole different city. Bring cash and comfortable shoes.'],
];

const TEMPLATES = {
  witnessed: [
    'Did anyone else just see that on {district}? Someone is getting arrested tonight.',
    'BRO. Right in front of me on {district}. I called it in, sorry not sorry.',
    'Just watched a whole crime happen on {district} and I am still shaking.',
  ],
  cctv: [
    'CCTV got the whole thing on {district}. The city sees everything now.',
    'Smile, you are on camera. {district} cam caught it all.',
  ],
  unseen: [
    'Quiet night on {district}. Almost TOO quiet.',
    'Nothing happening on {district}. Just how I like it.',
  ],
  starUp: [
    'Sirens everywhere near {district}! What is going on??',
    'Police flooding {district} right now. Avoid the area.',
    'Half the VPD just flew past me toward {district}. Stay safe out there.',
  ],
  escaped: [
    'And just like that, the sirens are gone. Whoever that was, they vanished.',
    'Police gave up searching {district}. Ghost driver strikes again.',
  ],
  missionDone: [
    'Word is someone just finished a big job for Rosa. The garage is buzzing.',
    'Heard the Gulls took a beating at the docks. About time someone stood up to them.',
  ],
  kindness: [
    'Some kind stranger just helped a stranded driver on {district}. Faith in Verdeluz restored.',
    'Shoutout to whoever helped that driver on {district}. Good people still exist.',
  ],
  package: [
    'Found one of those weird glowing packages hidden around the city. There are more, right?',
    'Treasure hunt update: another package found. Verdeluz is full of secrets.',
  ],
  jump: [
    'SOMEONE JUST JUMPED A CAR OVER {district}?? I need the video immediately.',
    'Stunt driver spotted flying over {district}. This city never sleeps.',
  ],
  taxi: [
    'Fastest cab ride of my life through {district}. Five stars, no notes.',
    'That taxi driver knows every shortcut in Verdeluz. Incredible.',
  ],
  explosion: [
    'EXPLOSION on {district}!! Everyone okay??',
    'Something just blew up near {district}. Smoke everywhere.',
  ],
  kill: [
    'Heard shots on {district}. Locking my doors tonight.',
    'Something went down on {district}. Police tape everywhere.',
  ],
};

export function createFeed() {
  return {
    posts: [],
    unread: 0,
    ambientTimer: 14,
    seq: 0,
  };
}

function handle(rng) {
  return pick(rng, FEED_HANDLES);
}

function authorName(rng) {
  return pick(rng, PEOPLE_NAMES);
}

export function post(S, kind, district, extra) {
  const rng = Math.random;
  const list = TEMPLATES[kind];
  if (!list) return;
  const text = pick(rng, list).replace('{district}', district || 'downtown');
  const entry = {
    id: ++S.feed.seq,
    author: authorName(rng),
    handle: handle(rng),
    text,
    kind,
    tag: extra || null,
    time: S.timeOfDay,
    likes: rangeInt(rng, 3, 480),
    t: S.time,
  };
  S.feed.posts.unshift(entry);
  if (S.feed.posts.length > 30) S.feed.posts.pop();
  S.feed.unread++;
}

export function postCustom(S, author, handleText, text, tag) {
  const entry = {
    id: ++S.feed.seq,
    author,
    handle: handleText,
    text,
    kind: 'custom',
    tag: tag || null,
    time: S.timeOfDay,
    likes: rangeInt(Math.random, 12, 900),
    t: S.time,
  };
  S.feed.posts.unshift(entry);
  if (S.feed.posts.length > 30) S.feed.posts.pop();
  S.feed.unread++;
}

export function updateFeed(S, dt) {
  S.feed.ambientTimer -= dt;
  if (S.feed.ambientTimer <= 0) {
    S.feed.ambientTimer = 22 + Math.random() * 18;
    const rng = Math.random;
    const [tag, text] = pick(rng, AMBIENT);
    postCustom(S, authorName(rng), handle(rng), text, tag);
  }
}

export function markRead(S) {
  S.feed.unread = 0;
}
