# Pocket Operations Mobile Depot

Mobile-first, independent web utilities for Teenage Engineering Pocket Operators.

**First utility:** [PO-35 Bridge](https://udeudeude.github.io/Pocket-Operations-Mobile-Depot/po35-bridge/) for the PO-35 Speak.

## Live website

[Open Pocket Operations Mobile Depot](https://udeudeude.github.io/Pocket-Operations-Mobile-Depot/)

This URL works once GitHub Pages has been enabled. In **Settings → Pages**, select **Deploy from a branch**, choose **main**, and use the **/(root)** folder. The app uses only static files, with no build step or server.

## PO-35 Bridge v0.2

- **Load:** Choose and play an existing PO-35-compatible stereo WAV backup into PO-35 IN using a Lightning/headphone adapter and 3.5 mm stereo cable.
- **Save (experimental):** Capture uncompressed PCM audio from the available microphone route; see actual channel count, sample rate, and clipping warnings.
- **Library:** Keep files in local browser storage and export copies to the iPhone Files app.
- **Research:** Guided three-capture protocol (unchanged baseline A, independent baseline B, single-step modification C), WAV PCM inspection, per-channel levels, duplicated-channel warning, SHA-256 fingerprints, and JSON experiment manifest export.
- **Setup:** Wiring diagrams and browser diagnostics.
- **Offline:** Install from Safari using Share → Add to Home Screen after loading the app once online.

### Important limitations

The Lightning-to-3.5 mm Apple headset adapter produces **stereo headphone playback but only mono headset microphone input**. Teenage Engineering specifies *stereo, at least 16-bit / 44.1 kHz* for complete PO-35 backups. Safari may also apply microphone processing or change the audio route. Thus a recording made using this adapter is **experimental, not verified preservation**. A recorded file should never be trusted until successfully restored, and never overwrite valuable existing state without a trustworthy backup.

**Restoring a backup may overwrite sounds and patterns.**

For experimental recording, use a compatible CTIA TRRS headset breakout and an appropriate line-to-microphone attenuator. Avoid feeding headphone/line-level signals directly into a microphone input.

The application is a playback/recording and **WAV inspection** utility. It **does not decode or encode PO-35 backup packets, create a valid PO-35 data protocol, or synthesize an arbitrary state**.

For protocol research, prefer the **Mid-2010 iMac stereo line-in + Audacity** workflow over the iPhone's mono input. See [Research protocol](po35-bridge/RESEARCH.md). A SHA-256 hash is for file identity only. Different analog captures of the same transmitted state may have different hashes.

## Privacy

No external analytics, backend, account, or audio upload. WAV files stay on the device unless exported. Browser IndexedDB data can be deleted by Safari; export important files to Files.

## Structure

- `index.html`: Depot landing page
- `po35-bridge/index.html`: PO-35 Bridge
- `po35-bridge/app.js`: Playback, WAV inspection, PCM capture, local library
- `po35-bridge/styles.css`: Mobile interface
- `po35-bridge/research.js`: WAV inspector and controlled experiment manifest builder
- `po35-bridge/RESEARCH.md`: First capture protocol
- `po35-bridge/sw.js`: Offline asset caching

Reference: [PO-35 official guide](https://teenage.engineering/guides/po-35/en).

This is an independent experiment, not an official Teenage Engineering product.
