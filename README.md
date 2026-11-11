# Chimera Motion Studio

This studio includes the actual [CHIMERA Vocal Synth](https://github.com/jamesondh/chimera-vocal-synth) application (upstream commit `6259e880f5d0108b862e98cefd930aa8c5bc0dc5`), including its Rust/WASM physical voice engine, singing editor, demos, and live 3D anatomical head. Upstream code is MIT licensed; see `CHIMERA-LICENSE` and the bundled font and dictionary licenses in `public`.

The app starts in Sing mode with the original 3D head. Click **Start and hear a song** to enable browser audio and hear the demo. In the 3D view, **Full body** adds a procedural anatomical line-art body connected to the animated neck, with selectable hair and clothing, motion and energy controls, and a live face close-up; **Head view** returns to the original framing. The body controls include build, speed, energy, variation, seed, and several procedural poses. These are local procedural motion, not MotionBricks inference or synchronized choreography.

In Sing mode choose **Edit song / MIDI** to open the editable piano roll. Click to add notes, drag to move them, and select a note to edit its pitch, beat, duration and syllable. Import a MIDI file and select a track; the editor quantizes to quarter-beats, uses the first tempo, clamps pitches to C2–C6 and converts overlapping notes to a single voice. Tracks are limited to 256 notes and 256 beats. Enter one syllable per note (longer words use their first syllable). Rests are preserved, and playback uses Chimera's physical voice. The current arrangement is saved in browser local storage. The original 2D view and other synth modes remain available. The earlier motion prototype is available at `motion.html`.

## Run locally

Requires Node 22+, Rust and the `wasm32-unknown-unknown` target:

```sh
rustup target add wasm32-unknown-unknown
cargo build --locked -p chimera-wasm --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/chimera_wasm.wasm synth/src/wasm/chimera.wasm
npm ci
npm run dev
```

The GitHub Actions workflow builds the WASM and site and deploys to GitHub Pages. The uploaded `chimera-wasm` workflow artifact can also be used for local development when a Rust toolchain is unavailable. Audio requires HTTPS or localhost and a user gesture.

## Live MIDI input

Use **MIDI IN** in the top toolbar to grant Web MIDI permission and connect all available inputs. The connection stays active when changing modes, and newly connected devices are picked up automatically. Play and Speak use the keyboard pitch and gate; Sing advances through the lyrics; Beatbox plays a pitched hum; Bestiary controls pitch or triggers the selected call. Note velocity affects singing. Disconnecting a device or the MIDI input releases its held notes. Web MIDI requires HTTPS and browser support; audio must be started by a user gesture. This is live keyboard input, separate from MIDI file import in the song editor.
