const BASE = 'https://everyayah.com/data';

export function buildAyahUrl(reciter, surah, ayah) {
  const s = String(surah).padStart(3, '0');
  const a = String(ayah).padStart(3, '0');
  return `${BASE}/${reciter}/${s}${a}.mp3`;
}

export class AyahPlayer {
  constructor() { this.audio = null; }
  play(url) {
    this.stop();
    this.audio = new Audio(url);
    this.audio.preload = 'auto';
    return this.audio.play();
  }
  stop() {
    if (this.audio) { this.audio.pause(); this.audio.currentTime = 0; this.audio = null; }
  }
}

export const RECITERS = [
  { id: 'Alafasy_64kbps',              name: 'Mishary Alafasy' },
  { id: 'Husary_64kbps',               name: 'Mahmoud Khalil Al-Husary' },
  { id: 'Abdul_Basit_Murattal_64kbps', name: 'Abdul Basit (Murattal)' },
  { id: 'Sudais_64kbps',               name: 'Abdurrahman As-Sudais' }
];
