// New-ticket sound: an on/off preference (persisted) and a Web Audio bell
// chime (~2.5 s), so no audio file or CDN is needed. Browsers keep an AudioContext suspended until a
// user gesture, so unlockAudio() must run from a click/keypress.

const STORAGE_KEY = 'ticket-alarm'

export type AlarmState = 'on' | 'on-locked' | 'off'

const listeners = new Set<() => void>()
let enabled: boolean | null = null
let ctx: AudioContext | null = null
let unlocked = false

function emit() {
  listeners.forEach(l => l())
}

// localStorage can throw (private mode, blocked site data): default to on.
function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function isAlarmEnabled(): boolean {
  if (enabled === null) enabled = readEnabled()
  return enabled
}

export function setAlarmEnabled(next: boolean) {
  enabled = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // Not persisted; the choice still holds for this page.
  }
  emit()
}

/** 'on-locked' = enabled, but the browser hasn't allowed sound yet (no gesture so far). */
export function getAlarmState(): AlarmState {
  if (!isAlarmEnabled()) return 'off'
  return unlocked ? 'on' : 'on-locked'
}

export function subscribeAlarm(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Call from a user gesture. Resolves true once the audio context is running. */
export async function unlockAudio(): Promise<boolean> {
  if (typeof AudioContext === 'undefined') return false
  try {
    ctx ??= new AudioContext()
    await ctx.resume()
  } catch {
    return false
  }
  const running = ctx.state === 'running'
  if (running && !unlocked) {
    unlocked = true
    emit()
  }
  return running
}

// A soft two-note bell chime (D6 then G6), rung twice with a long natural
// decay: ~2.5 s in all. Each note is a sine plus a quiet octave overtone with a
// quick attack and an exponential ring-out.
const CHIME_NOTES = [
  { freq: 1174.66, at: 0 }, // D6
  { freq: 1567.98, at: 0.11 }, // G6
]
// Second ring starts once the first has mostly faded, a little softer.
const CHIME_RINGS = [
  { at: 0, level: 1 },
  { at: 1.1, level: 0.75 },
]
const NOTE_DECAY_S = 1.3
const NOTE_PEAK = 0.16
const START_DELAY_S = 0.02

export interface DingPartial {
  freq: number
  /** Seconds after the sound starts. */
  start: number
  level: number
  /** Seconds the partial rings before it is silent. */
  decay: number
}

/** Every oscillator of the chime, relative to its start. Pure, so the length is testable. */
export function dingSchedule(): DingPartial[] {
  const partials: DingPartial[] = []
  for (const ring of CHIME_RINGS) {
    for (const note of CHIME_NOTES) {
      for (const [mult, share] of [
        [1, 1],
        [2, 0.25],
      ] as const) {
        partials.push({
          freq: note.freq * mult,
          start: START_DELAY_S + ring.at + note.at,
          level: NOTE_PEAK * ring.level * share,
          decay: NOTE_DECAY_S,
        })
      }
    }
  }
  return partials
}

/** Seconds from trigger until the last partial has faded. */
export const DING_DURATION_S = Math.max(...dingSchedule().map(p => p.start + p.decay))

// AudioContext time at which the current chime ends; a new one must not layer on it.
let ringingUntil = 0

function ding(audio: AudioContext): boolean {
  if (audio.currentTime < ringingUntil) return false
  const base = audio.currentTime
  for (const p of dingSchedule()) {
    const t = base + p.start
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = p.freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(p.level, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + p.decay + 0.02)
  }
  ringingUntil = base + DING_DURATION_S
  return true
}

/**
 * Plays the chime if enabled. Returns false when muted, when the browser still
 * blocks audio, or when the previous chime is still ringing (they never layer).
 */
export function playAlarm(): boolean {
  if (!isAlarmEnabled()) return false
  if (!ctx || ctx.state !== 'running') {
    // Not unlocked yet; a later click anywhere will. Nothing to play now.
    void ctx?.resume().catch(() => {})
    return false
  }
  try {
    return ding(ctx)
  } catch {
    return false
  }
}

/** The same chime regardless of the toggle, so enabling it confirms the sound works. */
export async function previewAlarm(): Promise<boolean> {
  if (!(await unlockAudio()) || !ctx) return false
  try {
    return ding(ctx)
  } catch {
    return false
  }
}
