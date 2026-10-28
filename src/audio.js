import * as Tone from "tone";
import { angleDiff } from "./kuramoto.js";

const SCALE = [
  ["D3", "F3", "G3", "A3", "C4", "D4", "F4", "A4"],
  ["A3", "C4", "D4", "E4", "G4", "A4", "C5", "E5"],
];

const AIRE_HZ = [110, 164.81];

function panFor(agent) {
  const column = { pulso: -0.72, arpegio: -0.28, aire: 0.28, falla: 0.74 };
  const row = agent.pair === 0 ? -0.08 : 0.08;
  return column[agent.personality] + row;
}

function makePulso(master, pair) {
  const noise = new Tone.Noise("white").start();
  const filter = new Tone.Filter(pair === 0 ? 2200 : 980, "highpass");
  const gain = new Tone.Gain(0.0001);
  const panner = new Tone.Panner(0);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(master);
  return { noise, filter, gain, panner };
}

function makeArpegio(master) {
  const synth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.004, decay: 0.11, sustain: 0, release: 0.04 },
  });
  synth.volume.value = -16;
  const panner = new Tone.Panner(0);
  synth.connect(panner);
  panner.connect(master);
  return { synth, panner };
}

function makeAire(master, pair) {
  const osc = new Tone.Oscillator(AIRE_HZ[pair], "triangle").start();
  const second = new Tone.Oscillator(AIRE_HZ[pair], "sine").start();
  second.detune.value = 7;
  const filter = new Tone.Filter(700, "lowpass");
  const gain = new Tone.Gain(0.04);
  const panner = new Tone.Panner(0);
  osc.connect(filter);
  second.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(master);
  return { osc, second, filter, gain, panner };
}

function makeFalla(master) {
  const noise = new Tone.Noise("pink").start();
  const filter = new Tone.Filter(900, "bandpass");
  filter.Q.value = 5;
  const gain = new Tone.Gain(0.0001);
  const panner = new Tone.Panner(0);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(master);
  return { noise, filter, gain, panner };
}

function spike(param, peak, seconds) {
  const now = Tone.now();
  param.cancelScheduledValues(now);
  param.setValueAtTime(0.0001, now);
  param.exponentialRampToValueAtTime(peak, now + 0.008);
  param.exponentialRampToValueAtTime(0.0001, now + seconds);
}

export async function createAudio(agents) {
  await Tone.start();

  const master = new Tone.Gain(0.9);
  const reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.015, wet: 0.2 });
  const limiter = new Tone.Limiter(-1.2);
  master.connect(reverb);
  reverb.connect(limiter);
  limiter.toDestination();
  await reverb.ready;

  const voices = agents.map((agent) => {
    if (agent.personality === "pulso") return { kind: "pulso", ...makePulso(master, agent.pair) };
    if (agent.personality === "arpegio") return { kind: "arpegio", ...makeArpegio(master) };
    if (agent.personality === "aire") return { kind: "aire", ...makeAire(master, agent.pair) };
    return { kind: "falla", ...makeFalla(master) };
  });

  const drone = new Tone.Oscillator(55, "sine").start();
  const droneGain = new Tone.Gain(0.02);
  drone.connect(droneGain);
  droneGain.connect(master);

  const bed = new Tone.Noise("white").start();
  const bedFilter = new Tone.Filter({ frequency: 1600, type: "bandpass", Q: 0.6 });
  const bedGain = new Tone.Gain(0.02);
  bed.connect(bedFilter);
  bedFilter.connect(bedGain);
  bedGain.connect(master);

  const thump = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 },
  }).connect(master);
  thump.volume.value = -10;

  let muted = false;

  function update(nextAgents, psi, r, shockEdge) {
    if (muted) return;

    droneGain.gain.value = 0.018 + r * 0.07;
    bedGain.gain.value = 0.012 + (1 - r) * 0.045;

    nextAgents.forEach((agent, index) => {
      const voice = voices[index];
      voice.panner.pan.value = panFor(agent);
      const error = angleDiff(agent.theta, psi);

      if (voice.kind === "pulso" && agent.wrapped) {
        spike(voice.gain.gain, agent.pair === 0 ? 0.28 : 0.22, 0.07);
      }

      if (voice.kind === "arpegio") {
        voice.synth.detune.value = (error / Math.PI) * 28;
        if (agent.stepChanged) {
          const note = SCALE[agent.pair][agent.step];
          voice.synth.triggerAttackRelease(note, 0.12);
        }
      }

      if (voice.kind === "aire") {
        const breath = Math.sin(agent.theta) * 0.5 + 0.5;
        voice.gain.gain.value = 0.025 + breath * 0.055;
        voice.second.detune.value = 7 + (error / Math.PI) * 36;
        const open = 1 - Math.abs(error) / Math.PI;
        voice.filter.frequency.value = 240 + open * 1700;
      }

      if (voice.kind === "falla") {
        const loud = (1 - Math.cos(error)) / 2;
        voice.gain.gain.value = loud * 0.11;
        voice.filter.frequency.value = 380 + (agent.theta / (Math.PI * 2)) * 1700;
      }
    });

    if (shockEdge) thump.triggerAttackRelease("C1", "8n");
  }

  return {
    update,
    setMuted(next) {
      muted = next;
      master.gain.value = next ? 0 : 0.9;
    },
    get muted() {
      return muted;
    },
    contextState: () => Tone.getContext().state,
  };
}
