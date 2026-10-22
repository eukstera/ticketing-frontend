import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A minimal AudioContext: counts oscillators and lets a test move the clock.
class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  currentTime = 0
  state: 'running' | 'suspended' = 'suspended'
  destination = {}
  oscillators = 0
  constructor() {
    FakeAudioContext.instances.push(this)
  }
  resume() {
    this.state = 'running'
    return Promise.resolve()
  }
  createOscillator() {
    this.oscillators++
    const osc = {
      type: '',
      frequency: { value: 0 },
      connect: (n: unknown) => n,
      start: vi.fn(),
      stop: vi.fn(),
    }
    return osc
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (n: unknown) => n,
    }
  }
}

// The module keeps the context, preference and "ringing until" in module state.
async function load() {
  vi.resetModules()
  return import('@/lib/alarm')
}

const audio = () => FakeAudioContext.instances[0]

beforeEach(() => {
  FakeAudioContext.instances = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chime length and shape', () => {
  it('rings for 2 to 3 seconds in total', async () => {
    const { DING_DURATION_S } = await load()
    expect(DING_DURATION_S).toBeGreaterThanOrEqual(2)
    expect(DING_DURATION_S).toBeLessThanOrEqual(3)
  })

  it('is two rings of the two-note chime, the second softer, each note with an overtone', async () => {
    const { dingSchedule } = await load()
    const partials = dingSchedule()
    expect(partials).toHaveLength(8) // 2 rings x 2 notes x (fundamental + overtone)

    const fundamentals = partials.filter((_, i) => i % 2 === 0)
    expect(fundamentals.map(p => p.freq)).toEqual([1174.66, 1567.98, 1174.66, 1567.98])
    expect(fundamentals[2].level).toBeLessThan(fundamentals[0].level)
    for (let i = 0; i < partials.length; i += 2) {
      expect(partials[i + 1].freq).toBeCloseTo(partials[i].freq * 2)
      expect(partials[i + 1].level).toBeLessThan(partials[i].level)
    }
  })

  it('stays gentle: sine waves at a low peak level, never starting before the clock', async () => {
    const { dingSchedule } = await load()
    for (const p of dingSchedule()) {
      expect(p.level).toBeLessThanOrEqual(0.2)
      expect(p.start).toBeGreaterThan(0)
      expect(p.decay).toBeGreaterThan(1)
    }
  })
})

describe('playing', () => {
  it('stays silent until the browser has allowed audio', async () => {
    const { playAlarm } = await load()
    expect(playAlarm()).toBe(false) // no context yet
    expect(FakeAudioContext.instances).toHaveLength(0)
  })

  it('plays the whole chime once unlocked', async () => {
    const { playAlarm, unlockAudio } = await load()
    expect(await unlockAudio()).toBe(true)
    expect(playAlarm()).toBe(true)
    expect(audio().oscillators).toBe(8)
  })

  it('does not layer a second chime while the first is still ringing', async () => {
    const { playAlarm, previewAlarm, unlockAudio, DING_DURATION_S } = await load()
    await unlockAudio()
    expect(playAlarm()).toBe(true)

    audio().currentTime = 1 // a poll finds more tickets mid-chime
    expect(playAlarm()).toBe(false)
    expect(await previewAlarm()).toBe(false) // nor does the Sound toggle's preview
    expect(audio().oscillators).toBe(8)

    audio().currentTime = DING_DURATION_S + 0.01
    expect(playAlarm()).toBe(true)
    expect(audio().oscillators).toBe(16)
  })

  it('the preview is the same chime and ignores the mute setting', async () => {
    const { previewAlarm, setAlarmEnabled, playAlarm } = await load()
    setAlarmEnabled(false)
    expect(await previewAlarm()).toBe(true)
    expect(audio().oscillators).toBe(8)

    audio().currentTime = 10
    expect(playAlarm()).toBe(false) // muted
    expect(audio().oscillators).toBe(8)
  })

  it('is silent when muted', async () => {
    const { playAlarm, setAlarmEnabled, unlockAudio } = await load()
    await unlockAudio()
    setAlarmEnabled(false)
    expect(playAlarm()).toBe(false)
    expect(audio().oscillators).toBe(0)
  })
})
