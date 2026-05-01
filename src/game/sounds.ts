let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15, delay: number = 0) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    const startTime = ctx.currentTime + delay;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {
    // Audio not available
  }
}

export function playPlaceSound() {
  playTone(900, 0.06, 'sine', 0.12);
  playTone(1200, 0.04, 'sine', 0.08, 0.02);
}

export function playPassSound() {
  playTone(350, 0.12, 'triangle', 0.1);
}

export function playWinSound() {
  playTone(523, 0.12, 'sine', 0.15);
  playTone(659, 0.12, 'sine', 0.15, 0.12);
  playTone(784, 0.2, 'sine', 0.15, 0.24);
  playTone(1047, 0.3, 'sine', 0.12, 0.44);
}

export function playLoseSound() {
  playTone(400, 0.2, 'sine', 0.12);
  playTone(300, 0.3, 'sine', 0.1, 0.2);
}

export function playDealSound() {
  for (let i = 0; i < 7; i++) {
    playTone(500 + i * 40, 0.03, 'sine', 0.06, i * 0.04);
  }
}

export function playClickSound() {
  playTone(700, 0.04, 'sine', 0.08);
}

export function playSelectSound() {
  playTone(600, 0.06, 'sine', 0.1);
  playTone(800, 0.04, 'sine', 0.06, 0.03);
}

export function playTrancaSound() {
  playTone(300, 0.15, 'triangle', 0.12);
  playTone(250, 0.2, 'triangle', 0.1, 0.15);
  playTone(200, 0.25, 'triangle', 0.08, 0.3);
}