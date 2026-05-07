/**
 * SysEx encoding/decoding for Korg Electribe 2 pattern dumps.
 *
 * MIDI SysEx data bytes must be 0-127 (7-bit). To transmit 8-bit pattern data,
 * Korg uses a packing scheme: every 7 input bytes produce 8 output bytes.
 * A "MSB byte" precedes each group, carrying the high bit of each data byte.
 *
 * Two dump commands are supported:
 * - 0x40: Current pattern dump (no pattern number)
 * - 0x4C: Numbered pattern dump (includes LSB/MSB of pattern index)
 *
 * SysEx message structure:
 *   F0 42 3g 00 01 dd cc [ll mm] <7-bit-encoded-data> F7
 *   F0 = SysEx start, 42 = Korg manufacturer ID
 *   3g = 0x30 + global MIDI channel (0-15)
 *   00 01 = Electribe 2 product family
 *   dd = device ID (default 0x23 for e2 sampler)
 *   cc = command (0x40 or 0x4C)
 *   ll mm = pattern number LSB/MSB (only for 0x4C)
 *   F7 = SysEx end
 */

import { Pattern } from "./models/pattern.js";

const KORG_MANUFACTURER_ID = 0x42;
const DEFAULT_DEVICE_ID = 0x23;
const CURRENT_PATTERN_DUMP = 0x40;
const PATTERN_DUMP = 0x4c;

/**
 * Encode 8-bit data to 7-bit MIDI-safe bytes using Korg's packing scheme.
 * Every 7 input bytes become 8 output bytes: [MSB, d0&0x7F, d1&0x7F, ... d6&0x7F]
 * where MSB carries the high bit of each data byte in its low 7 bits.
 */
export function encodeSysExPayload(data: Buffer): Buffer {
  const result: number[] = [];
  for (let start = 0; start < data.length; start += 7) {
    const chunk = data.subarray(start, start + 7);
    let msb = 0;
    const encoded: number[] = [];
    for (let idx = 0; idx < chunk.length; idx++) {
      msb |= ((chunk[idx] & 0x80) >> 7) << idx;
      encoded.push(chunk[idx] & 0x7f);
    }
    result.push(msb, ...encoded);
  }
  return Buffer.from(result);
}

/** Decode 7-bit MIDI SysEx data back to 8-bit bytes. Reverse of encodeSysExPayload. */
export function decodeSysExPayload(data: Buffer): Buffer {
  const result: number[] = [];
  for (let start = 0; start < data.length; start += 8) {
    const chunk = data.subarray(start, start + 8);
    if (chunk.length === 0) continue;
    const msb = chunk[0];
    for (let idx = 1; idx < chunk.length; idx++) {
      result.push(chunk[idx] | (((msb & (1 << (idx - 1))) >> (idx - 1)) << 7));
    }
  }
  return Buffer.from(result);
}

function patternNumberToMidi(patternNumber: number): [number, number] {
  if (patternNumber < 1 || patternNumber > 250) throw new Error("Pattern number must be between 1 and 250");
  const index = patternNumber - 1;
  return [index % 128, Math.floor(index / 128)];
}

/** Convert a Pattern to a complete SysEx message ready for MIDI transmission. */
export function patternToSysex(
  pattern: Pattern,
  opts?: { patternNumber?: number; deviceId?: number; globalChannel?: number }
): Buffer {
  const deviceId = opts?.deviceId ?? DEFAULT_DEVICE_ID;
  const globalChannel = opts?.globalChannel ?? 0;
  const patternNumber = opts?.patternNumber;

  if (globalChannel < 0 || globalChannel > 15) throw new Error("Global channel must be between 0 and 15");
  if (deviceId < 0 || deviceId > 127) throw new Error("Device ID must be a 7-bit MIDI byte");

  const header = Buffer.from([0xf0, KORG_MANUFACTURER_ID, 0x30 + globalChannel, 0x00, 0x01, deviceId]);
  let command: Buffer;
  if (patternNumber === undefined) {
    command = Buffer.from([...header, CURRENT_PATTERN_DUMP]);
  } else {
    const [lsb, msb] = patternNumberToMidi(patternNumber);
    command = Buffer.from([...header, PATTERN_DUMP, lsb, msb]);
  }

  return Buffer.concat([command, encodeSysExPayload(pattern.raw), Buffer.from([0xf7])]);
}

/** Parse a SysEx dump message and return a wrapped Pattern (.e2pat format). */
export function sysexToPattern(data: Buffer, deviceName = "e2sampler"): Pattern {
  if (data.length < 8 || data[0] !== 0xf0 || data[data.length - 1] !== 0xf7) {
    throw new Error("Invalid SysEx message wrapper");
  }
  const command = data[6];
  let payload: Buffer;
  if (command === CURRENT_PATTERN_DUMP) {
    payload = data.subarray(7, data.length - 1);
  } else if (command === PATTERN_DUMP) {
    payload = data.subarray(9, data.length - 1);
  } else {
    throw new Error(`Unsupported SysEx pattern command: 0x${command.toString(16).padStart(2, "0")}`);
  }

  const raw = decodeSysExPayload(payload);
  return Pattern.fromBytes(Pattern.fromBytes(raw).toWrappedBytes(deviceName));
}
