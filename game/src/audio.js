// audio.js — every sound in Sky Courier is synthesised with WebAudio; there are no samples.
// Design intent: the engine is the instrument you fly by ear — a pair of detuned oscillators
// and a filtered noise bed whose pitch and loudness follow throttle and airspeed, so a
// climbing, stalling or diving aeroplane sounds like one. Everything else is small and
// deliberate: a two-note chime for a ring, a soft thump for a crate, a thud and a chirp of
// tyres for a touchdown, and a beeper that only sounds when the wing is about to give up.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineSub = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let beepTimer = 0;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // The engine: a sawtooth for the prop's buzz and a square an octave under it for body.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineSub = ctx.createOscillator();
    engineSub.type = 'square';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineSub.start();

    // The wind: looped white noise through a bandpass whose pitch follows the airspeed.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 400;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    noise.start();
    return true;
  }

  function blip(freq, at, dur, type = 'sine', gain = 0.16) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + at;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function thud(strength) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.22);
    g.gain.setValueAtTime(0.5 * strength, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(g);
    g.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  return {
    /** Start the context (needs a user gesture) and bring the engine to idle. */
    start() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    /** Follow the aeroplane: called every frame with the model's own numbers. */
    update(plane, dt) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const rpm = 30 + plane.throttle * 68 + plane.speed * 0.14;
      engineOsc.frequency.setTargetAtTime(rpm, t, 0.06);
      engineSub.frequency.setTargetAtTime(rpm / 2, t, 0.06);
      const engineLevel = plane.fuel > 0 ? 0.05 + plane.throttle * 0.11 : 0.012;
      engineGain.gain.setTargetAtTime(engineLevel, t, 0.09);
      windFilter.frequency.setTargetAtTime(240 + plane.speed * 9, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.16, plane.speed * 0.0016), t, 0.12);
      // The stall beeper: two short pips a second while the wing is stalled.
      if (plane.stalled) {
        beepTimer -= dt;
        if (beepTimer <= 0) {
          blip(1180, 0, 0.09, 'square', 0.05);
          beepTimer = 0.34;
        }
      } else {
        beepTimer = 0;
      }
    },
    ring() {
      blip(880, 0, 0.16);
      blip(1318, 0.09, 0.24);
    },
    drop() {
      blip(300, 0, 0.14, 'triangle', 0.2);
      blip(190, 0.07, 0.2, 'triangle', 0.16);
    },
    crateLanded(good) {
      if (good) {
        blip(660, 0, 0.12);
        blip(990, 0.08, 0.2);
      } else {
        thud(0.4);
      }
    },
    touchdown(hard) {
      thud(hard ? 0.9 : 0.5);
      blip(2100, 0.02, 0.07, 'sine', 0.05); // the tyres' chirp
    },
    takeoff() {
      blip(520, 0, 0.12, 'triangle', 0.08);
    },
    crash() {
      thud(1);
      blip(140, 0, 0.5, 'sawtooth', 0.2);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
