import * as Tone from "tone";
import { TAU, angleDiff } from "./kuramoto.js";

const SCALE = [
  ["D3", "F3", "G3", "A3", "C4", "D4", "F4", "A4"],
  ["A3", "C4", "D4", "E4", "G4", "A4", "C5", "E5"],
];

const AIRE_HZ = [110, 164.81];

// A partir de aquí el nodo ya no va con el grupo: entra el glitch.
const SLIP = 0.32;

function panFor(agent) {
  const column = { pulso: -0.72, arpegio: -0.28, aire: 0.28, falla: 0.74 };
  const row = agent.pair === 0 ? -0.08 : 0.08;
  return column[agent.personality] + row;
}

function slipOf(error) {
  return Math.min(1, Math.abs(error) / Math.PI);
}

function raised(note, semitones) {
  return Tone.Frequency(note).transpose(semitones).toNote();
}

function makePulso(cut, pair) {
  const noise = new Tone.Noise("brown").start();
  const filter = new Tone.Filter(pair === 0 ? 160 : 110, "lowpass");
  const gain = new Tone.Gain(0.0001);
  const panner = new Tone.Panner(0);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(cut);
  return { noise, filter, gain, panner };
}

function makeArpegio(body, cut) {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.06, decay: 0.45, sustain: 0.28, release: 1.7 },
    maxPolyphony: 6,
  });
  synth.volume.value = -22;
  const glitch = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
  });
  glitch.volume.value = -12;
  const panner = new Tone.Panner(0);
  const glitchPan = new Tone.Panner(0);
  synth.connect(panner);
  panner.connect(body);
  glitch.connect(glitchPan);
  glitchPan.connect(cut);
  return { synth, glitch, panner, glitchPan };
}

function makeAire(body, pair) {
  const osc = new Tone.Oscillator(AIRE_HZ[pair], "sine").start();
  const second = new Tone.Oscillator(AIRE_HZ[pair], "sine").start();
  second.detune.value = 6;
  const filter = new Tone.Filter(520, "lowpass");
  const gain = new Tone.Gain(0.03);
  const panner = new Tone.Panner(0);
  osc.connect(filter);
  second.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(body);
  return { osc, second, filter, gain, panner };
}

function makeFalla(cut) {
  const noise = new Tone.Noise("pink").start();
  const filter = new Tone.Filter(240, "bandpass");
  filter.Q.value = 7;
  const gain = new Tone.Gain(0.0001);
  const panner = new Tone.Panner(0);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(cut);
  return { noise, filter, gain, panner };
}

function heartbeat(param, peak, seconds, stutter) {
  const now = Tone.now();
  param.cancelScheduledValues(now);
  param.setValueAtTime(0.0001, now);
  param.exponentialRampToValueAtTime(peak, now + 0.035);
  param.exponentialRampToValueAtTime(peak * 0.28, now + 0.1);
  param.exponentialRampToValueAtTime(0.0001, now + seconds);
  if (!stutter) return;
  const again = now + seconds + 0.045;
  param.setValueAtTime(0.0001, again);
  param.exponentialRampToValueAtTime(peak * 0.75, again + 0.012);
  param.exponentialRampToValueAtTime(0.0001, again + 0.06);
}

export async function createAudio(agents) {
  await Tone.start();

  const body = new Tone.Gain(1);
  const cut = new Tone.Gain(1);
  const send = new Tone.Gain(0.72);
  const nearSend = new Tone.Gain(0.16);
  const reverb = new Tone.Reverb({ decay: 8, preDelay: 0.04, wet: 1 });
  const dry = new Tone.Gain(1);
  const limiter = new Tone.Limiter(-1.8);
  const output = new Tone.Gain(0.9);

  body.connect(dry);
  body.connect(send);
  cut.connect(dry);
  cut.connect(nearSend);
  send.connect(reverb);
  nearSend.connect(reverb);
  reverb.connect(dry);
  dry.connect(limiter);
  limiter.connect(output);
  output.toDestination();
  await reverb.ready;

  const voices = agents.map((agent) => {
    if (agent.personality === "pulso") return { kind: "pulso", ...makePulso(cut, agent.pair) };
    if (agent.personality === "arpegio") return { kind: "arpegio", ...makeArpegio(body, cut) };
    if (agent.personality === "aire") return { kind: "aire", ...makeAire(body, agent.pair) };
    return { kind: "falla", ...makeFalla(cut) };
  });

  const drone = new Tone.Oscillator(55, "sine").start();
  const droneBeat = new Tone.Oscillator(55.7, "sine").start();
  const droneFifth = new Tone.Oscillator(82.5, "sine").start();
  const droneGain = new Tone.Gain(0.04);
  const beatGain = new Tone.Gain(0.032);
  const fifthGain = new Tone.Gain(0.008);
  const droneFilter = new Tone.Filter(260, "lowpass");
  drone.connect(droneGain);
  droneBeat.connect(beatGain);
  droneFifth.connect(fifthGain);
  droneGain.connect(droneFilter);
  beatGain.connect(droneFilter);
  fifthGain.connect(droneFilter);
  droneFilter.connect(body);

  const bed = new Tone.Noise("pink").start();
  const bedFilter = new Tone.Filter({ frequency: 420, type: "bandpass", Q: 0.7 });
  const bedGain = new Tone.Gain(0.02);
  bed.connect(bedFilter);
  bedFilter.connect(bedGain);
  bedGain.connect(cut);

  const thump = new Tone.MembraneSynth({
    pitchDecay: 0.12,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.1 },
  }).connect(cut);
  thump.volume.value = -14;

  let muted = false;

  function update(nextAgents, psi, r, shockEdge) {
    if (muted) return;

    const mass = 0.034 + r * 0.03;
    droneGain.gain.value = mass;
    beatGain.gain.value = mass * 0.82;
    fifthGain.gain.value = 0.006 + r * 0.034;
    droneFilter.frequency.value = 160 + r * 180;
    bedGain.gain.value = 0.008 + (1 - r) * 0.06;

    nextAgents.forEach((agent, index) => {
      const voice = voices[index];
      const pan = panFor(agent);
      voice.panner.pan.value = pan;
      if (voice.glitchPan) voice.glitchPan.pan.value = pan;
      const error = angleDiff(agent.theta, psi);
      const slip = slipOf(error);
      const glitch = slip > SLIP;

      if (voice.kind === "pulso" && agent.wrapped) {
        heartbeat(voice.gain.gain, agent.pair === 0 ? 0.11 : 0.08, 0.24, glitch);
      }

      if (voice.kind === "arpegio") {
        voice.synth.set({ detune: (error / Math.PI) * 18 });
        if (agent.stepChanged) {
          const note = SCALE[agent.pair][agent.step];
          const coin = Math.sin(agent.theta * 5 + agent.phi);
          if (!glitch) {
            voice.synth.triggerAttackRelease(raised(note, 12), 0.55);
          } else if (coin > 0.55) {
            // El paso se calla: el corte.
          } else if (coin > 0) {
            voice.glitch.triggerAttackRelease(raised(note, 24), 0.04);
          } else {
            voice.glitch.triggerAttackRelease(raised(note, 12), 0.05);
          }
        }
      }

      if (voice.kind === "aire") {
        const breath = Math.sin(agent.theta) * 0.5 + 0.5;
        voice.gain.gain.value = 0.016 + breath * 0.028;
        voice.second.detune.value = 6 + (error / Math.PI) * 42;
        const open = 1 - slip;
        voice.filter.frequency.value = 240 + open * 700;
      }

      if (voice.kind === "falla") {
        const loud = (1 - Math.cos(error)) / 2;
        const chop = glitch && Math.sin(agent.theta * 11) < 0.15 ? 0.05 : 1;
        voice.gain.gain.value = loud * 0.07 * chop;
        voice.filter.frequency.value = 120 + (agent.theta / TAU) * 460;
      }
    });

    if (shockEdge) thump.triggerAttackRelease("C1", "4n");
  }

  return {
    update,
    setMuted(next) {
      muted = next;
      output.gain.value = next ? 0 : 0.9;
    },
    get muted() {
      return muted;
    },
    contextState: () => Tone.getContext().state,
  };
}
