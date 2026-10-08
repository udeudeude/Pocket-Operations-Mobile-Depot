# PO-35 controlled backup research

The aim is to determine whether a PO-35 Speak backup shares framing, modulation, or packet structure with existing PO-32/PO-33 investigations. **This procedure does not assume compatibility** with `libpo32` or `po-backup-decode`.

## Hardware and Audacity

- Connect **PO-35 right-side audio OUT → standard 3.5 mm stereo TRS cable → Mid-2010 iMac line input**. This provides a real stereo capture route; the Lightning CTIA headset microphone is mono and is unsuitable as the primary protocol research capture.
- In macOS/Audacity, select the iMac's line input, **stereo channels**, and 44.1 kHz (or 48 kHz) capture. Confirm the resulting exported WAV has two independent channels.
- Record direct, with no EQ, voice enhancement, noise reduction, audio effects, normalization, limiter, fades, or MP3/AAC compression.
- Set a conservative input level to avoid clipping. The transfer modulation is data, and hardware can fail even if it sounds acceptable by ear.
- Save **unmodified PCM WAV files in stereo at at least 16-bit / 44.1 kHz**. Keep all three originals separately.

## Make the three captures

1. **A / baseline 1:** Start Audacity capture; use `WRITE + SOUND` on PO-35 to transmit a complete state; stop after transfer ends; export as `PO35-A-baseline-1.wav`.
2. **B / baseline 2:** Do **not change anything on the PO-35**. Record an independent repeat; export as `PO35-B-baseline-2.wav`.
3. **C / single-step change:** Change exactly one step of one sequencer pattern, noting pattern number, sound slot, step number, and old/new state. Don't change tempo, sound, or other settings. Record again, `PO35-C-one-step.wav`.

If it's difficult to establish the original step state, note the actual difference instead of claiming that it went from OFF to ON.

## Inspect and export

On the [PO-35 Bridge app](https://udeudeude.github.io/Pocket-Operations-Mobile-Depot/po35-bridge/), open **Research**; import A, B, and C into their labeled slots. The app will read WAV header metadata, estimate per-channel peak/RMS/clipping and channel similarity from representative samples, compute SHA-256 hashes of the original file bytes, and generate an optional JSON manifest.

These tests are **not** a valid data demodulator or a validation of restore. Different analog recordings can contain identical digital payloads but different file hashes; similarly, two-channel WAV containers can contain duplicated mono audio. The inspector warns of suspicious recordings but **does not modify the WAVs**.

Upload the **three original WAV files**, plus the downloaded manifest, for demodulation and further investigation. The manifest is not a substitute for the recordings.

## Reference research

- [Teenage Engineering PO-35 guide, section 7: data transfer](https://teenage.engineering/guides/po-35/en)
- [libpo32 (PO-32 acoustic transfers)](https://github.com/ericlewis/libpo32)
- [po-backup-decode (PO-33 decoder; PO-35 compatibility explicitly unverified)](https://github.com/danielpradilla/po-backup-decode)

## Safety and reversibility

Receiving an incoming backup on the PO-35 can overwrite sounds and patterns; **recording the PO-35's outgoing data doesn't itself overwrite the state**. Don't test restoration on a valuable state without a verified backup.

Avoid irreversible circuit modifications for this experiment. No acoustic transfer, cable loopback, or mono-to-stereo duplication can substitute for capturing the original dual-channel signal.
