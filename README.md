# Chimera Motion Studio

This studio includes the actual [CHIMERA Vocal Synth](https://github.com/jamesondh/chimera-vocal-synth) application (upstream commit `6259e880f5d0108b862e98cefd930aa8c5bc0dc5`), including its Rust/WASM physical voice engine, singing editor, demos, and live 3D anatomical head. Upstream code is MIT licensed; see `CHIMERA-LICENSE` and the bundled font and dictionary licenses in `public`.

The app starts in Sing mode with the original 3D head. Click **Start and hear a song** to enable browser audio and hear the demo. In the 3D view, **Full body** adds a procedural anatomical line-art body connected to the animated neck, with selectable hair and clothing, motion and energy controls, and a live face close-up; **Head view** returns to the original framing. The body's movement is an early local prototype, not MotionBricks inference or synchronized choreography. The original 2D view and other synth modes remain available. The earlier motion prototype is available at `motion.html`.

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
