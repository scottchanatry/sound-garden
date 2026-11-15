import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const SOURCES = [
  require('../assets/tones/tone0.wav'),
  require('../assets/tones/tone1.wav'),
  require('../assets/tones/tone2.wav'),
  require('../assets/tones/tone3.wav'),
  require('../assets/tones/tone4.wav'),
  require('../assets/tones/tone5.wav'),
  require('../assets/tones/tone6.wav'),
  require('../assets/tones/tone7.wav'),
  require('../assets/tones/tone8.wav'),
  require('../assets/tones/tone9.wav'),
];

// A few players per note, used in turn, so a note can ring over itself.
const VOICES = 3;
const pools = SOURCES.map(() => ({ players: [], next: 0 }));
let prepared = false;

export function prepareSound() {
  if (prepared) return;
  prepared = true;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

export function ring(note, volume = 1) {
  const pool = pools[note];
  if (!pool) return;
  try {
    let player = pool.players[pool.next];
    if (!player) {
      player = createAudioPlayer(SOURCES[note]);
      pool.players[pool.next] = player;
    }
    pool.next = (pool.next + 1) % VOICES;
    player.volume = Math.min(1, Math.max(0, volume));
    Promise.resolve(player.seekTo(0)).catch(() => {});
    player.play();
  } catch (error) {
    // Sound is a nicety: the garden still works if a player fails.
  }
}

export function releaseSound() {
  for (const pool of pools) {
    for (const player of pool.players) {
      try {
        player.remove();
      } catch (error) {}
    }
    pool.players = [];
    pool.next = 0;
  }
}
