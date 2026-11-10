# Chimera Motion Studio

A browser-based creative studio prototype for exploring a neon generative performer, motion presets and sound together. Built with Three.js and Vite.

## Run locally

```sh
npm ci
npm run dev
```

Drag the stage to orbit and scroll to zoom. Choose a movement, adjust energy and speed, and press play. Choose a browser-generated tone or upload your own audio. The timeline can be scrubbed; Record downloads a **silent** WebM of the stage, and Export downloads the current settings as JSON.

## Integration status

The procedural rig and browser oscillator are local prototypes, **not** integrations with [Chimera Vocal Synth](https://github.com/jamesondh/chimera-vocal-synth) or [MotionBricks Live](https://huggingface.co/spaces/monoradio/motionbricks-live). Connecting those projects' actual synthesis and motion inference interfaces, audio-inclusive recording, and persistent project editing are future work. Uploaded audio stays in the browser and is not included in the JSON export.

## Deploy

The GitHub Actions workflow builds and deploys the current working branch to GitHub Pages. Set the repository's Pages source to **GitHub Actions** in repository settings if it is not already configured. `BASE_PATH` is set to the repository path in CI for project Pages URLs.
