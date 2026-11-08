// リアルおじさんの声。
//   ① assets/voice/<key>.mp3(本物の人間の録音)があればそれを再生
//   ② なければ端末の読み上げ(男性の日本語の声を優先)で話す
const MALE_HINT = /otoya|ichiro|hattori|takumi|keita|kenji|male|男|google 日本語/i;
const FEMALE_HINT = /kyoko|haruka|ayumi|nanami|o-?ren|sayaka|mizuki|female|女|sakura|shiori/i;

export class RealVoice {
  constructor(getVolume) {
    this.getVolume = getVolume; this.missing = new Set(); this.audio = null; this.token = 0; this.voice = null;
    if ('speechSynthesis' in window) {
      const pick = () => {
        const ja = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
        this.voice = ja.find(v => MALE_HINT.test(v.name) && !FEMALE_HINT.test(v.name)) || ja.find(v => !FEMALE_HINT.test(v.name)) || ja[0] || null;
        this.voiceIsMale = !!this.voice && MALE_HINT.test(this.voice.name) && !FEMALE_HINT.test(this.voice.name);
      };
      pick(); speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  say(text, key) {
    this.stop();
    const my = ++this.token;
    if (key && !this.missing.has(key)) {
      const a = new Audio(`./assets/voice/${key}.mp3`); this.audio = a;
      a.volume = Math.min(1, this.getVolume());
      let fell = false;
      const fallback = () => { if (fell || my !== this.token) return; fell = true; this.missing.add(key); this.tts(text); };
      a.addEventListener('error', fallback);
      a.play().catch(fallback);
      return;
    }
    this.tts(text);
  }

  tts(text) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; if (this.voice) u.voice = this.voice;
    // 男性の声が見つからないときは、低めの声にして「おじさん」ぽくする
    u.pitch = this.voiceIsMale ? 0.85 : 0.5; u.rate = 0.95;
    u.volume = Math.min(1, this.getVolume());
    speechSynthesis.speak(u);
  }

  stop() {
    this.token++;
    if (this.audio) { try { this.audio.pause(); } catch (e) {} this.audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}
