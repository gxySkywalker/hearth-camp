// Generate a simple mail-open chime WAV file
// Two-note rising bell tone (C5→E5), ~350ms, soft and gentle

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SAMPLE_RATE = 44100
const BITS_PER_SAMPLE = 16
const CHANNELS = 1
const VOLUME = 0.25

const TONE1_FREQ = 523.25
const TONE2_FREQ = 659.25
const TONE1_DURATION = 0.17
const TONE2_DURATION = 0.17
const GAP = 0.02
const TOTAL_DURATION = TONE1_DURATION + GAP + TONE2_DURATION

const totalSamples = Math.floor(SAMPLE_RATE * TOTAL_DURATION)
const tone1Samples = Math.floor(SAMPLE_RATE * TONE1_DURATION)
const gapSamples = Math.floor(SAMPLE_RATE * GAP)
const tone2Start = tone1Samples + gapSamples

const samples = new Int16Array(totalSamples)

for (let i = 0; i < totalSamples; i++) {
  let value = 0

  if (i < tone1Samples) {
    const t = i / SAMPLE_RATE
    const envelope = Math.exp(-t * 6) * 0.6
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.005))
    value = Math.sin(2 * Math.PI * TONE1_FREQ * t) * envelope * attack
  } else if (i >= tone2Start) {
    const t = (i - tone2Start) / SAMPLE_RATE
    const envelope = Math.exp(-t * 5) * 0.7
    const attack = Math.min(1, (i - tone2Start) / (SAMPLE_RATE * 0.005))
    value = Math.sin(2 * Math.PI * TONE2_FREQ * t) * envelope * attack
  }

  // Subtle harmonic for warmth
  if (i < tone1Samples) {
    const t = i / SAMPLE_RATE
    value += Math.sin(2 * Math.PI * TONE1_FREQ * 2 * t) * Math.exp(-t * 8) * 0.15
  } else if (i >= tone2Start) {
    const t = (i - tone2Start) / SAMPLE_RATE
    value += Math.sin(2 * Math.PI * TONE2_FREQ * 2 * t) * Math.exp(-t * 7) * 0.12
  }

  const scaled = Math.max(-1, Math.min(1, value * VOLUME))
  samples[i] = Math.floor(scaled * 32767)
}

const dataSize = totalSamples * (BITS_PER_SAMPLE / 8) * CHANNELS
const buffer = Buffer.alloc(44 + dataSize)

buffer.write('RIFF', 0)
buffer.writeUInt32LE(36 + dataSize, 4)
buffer.write('WAVE', 8)

buffer.write('fmt ', 12)
buffer.writeUInt32LE(16, 16)
buffer.writeUInt16LE(1, 20)
buffer.writeUInt16LE(CHANNELS, 22)
buffer.writeUInt32LE(SAMPLE_RATE, 24)
buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8, 28)
buffer.writeUInt16LE(CHANNELS * BITS_PER_SAMPLE / 8, 32)
buffer.writeUInt16LE(BITS_PER_SAMPLE, 34)

buffer.write('data', 36)
buffer.writeUInt32LE(dataSize, 40)

for (let i = 0; i < totalSamples; i++) {
  buffer.writeInt16LE(samples[i], 44 + i * 2)
}

const outPath = path.join(__dirname, '..', '..', 'public', 'audio', 'mail_open.wav')
fs.writeFileSync(outPath, buffer)
console.log(`Generated: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB, ${TOTAL_DURATION.toFixed(3)}s)`)
