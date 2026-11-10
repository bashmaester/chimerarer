/**
 * The face screen in 3D: the head, turned with the pointer (drag to turn, wheel or pinch to zoom,
 * right-drag to pan, double-click to go back). The articulators can't be dragged here; the 2D
 * view keeps the handles. three.js draws into its own canvas, which is copied into the screen's
 * 2D canvas each frame so the readouts, the words at the mouth and the glow pass are the 2D
 * view's own.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { studioBody } from "../render/studioBody.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Anatomy3D } from "../render/anatomy3d.ts";
import { Petting } from "../render/petting.ts";
import { drawReadouts } from "../render/readouts.ts";
import { Glow, label } from "../render/vector.ts";
import { engine } from "../../audio/AudioEngine.ts";
import { sameBody } from "../body.ts";
import { useStore } from "../store.ts";
import { VoiceModel } from "../analysis.ts";
import { useModel } from "../useModel.ts";
import { V } from "../colors.ts";
import { articulatorSlots, tractInfo, type InfoFn, type OverlayFn, type SlotsFn } from "./AnatomyView.tsx";
import type { ViewFlags } from "../render/anatomy.ts";
import type { HumanArtic } from "../../wasm/engine.ts";
import type { TelemetryMessage } from "../../worklet/protocol.ts";

/**
 * A head driven by something other than the live engine (the duet page's recordings): its own
 * body's model and view flags, and each frame's telemetry. `tele` null holds the head in `artic`
 * with the voice at rest; a new `epoch` (a seek) drops the face's and the airflow's history.
 */
export interface HeadFeed {
  model: VoiceModel;
  view: ViewFlags;
  frame(): { tele: TelemetryMessage | null; artic: HumanArtic; epoch: number };
  /** cap on the device pixel ratio (two heads on a phone draw half the pixels at 1.5) */
  maxDpr?: number;
  /** which way the head turns to show its face (see Anatomy3D.facing) */
  facing?: 1 | -1;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function AnatomyView3D(props: { slots?: SlotsFn; info?: InfoFn; showFormants?: boolean; overlay?: OverlayFn; feed?: HeadFeed; readouts?: boolean }) {
  const feedRef = useRef<HeadFeed | undefined>(props.feed);
  feedRef.current = props.feed;
  const readoutsRef = useRef(props.readouts ?? true);
  readoutsRef.current = props.readouts ?? true;
  const overlayRef = useRef<OverlayFn | undefined>(props.overlay);
  overlayRef.current = props.overlay;
  const formantsRef = useRef(props.showFormants ?? true);
  formantsRef.current = props.showFormants ?? true;
  const slotsRef = useRef<SlotsFn>(props.slots ?? articulatorSlots);
  slotsRef.current = props.slots ?? articulatorSlots;
  const infoRef = useRef<InfoFn>(props.info ?? tractInfo);
  infoRef.current = props.info ?? tractInfo;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const model = useModel();
  const [failed, setFailed] = useState(false);
  const [bodyVisible, setBodyVisible] = useState(false);
  const [movement, setMovement] = useState("Liquid sway");
  const [energy, setEnergy] = useState(0.65);
  const [hair, setHair] = useState("Long");
  const [clothing, setClothing] = useState("Tank top");
  const [build, setBuild] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [variety, setVariety] = useState(.4);
  const [seed, setSeed] = useState(1);
  const bodySettings = useRef({ bodyVisible, movement, energy, hair, clothing, build, speed, variety, seed });
  bodySettings.current = { bodyVisible, movement, energy, hair, clothing, build, speed, variety, seed };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const wrap = wrapRef.current!;
    const glCanvas = document.createElement("canvas");
    let gl: THREE.WebGLRenderer;
    try {
      gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setFailed(true);
      return;
    }
    // the palette's sRGB values go straight through, as on the 2D screens
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.setClearColor(0x000000, 1);
    const r = new Anatomy3D();
    const body = studioBody(r.scene);
    let bodyFramed = false;
    r.centred = !readoutsRef.current;
    r.facing = feedRef.current?.facing ?? 1;
    const glow = new Glow();
    const camera = r.camera;
    const detailCamera = new THREE.PerspectiveCamera(24, 1, 5, 2000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;
    controls.screenSpacePanning = true;
    controls.minDistance = 20;
    controls.maxDistance = 500;

    // camera moves (the opening turn from the side view, double-click home): orbit round the target
    const tween = { on: false, t: 0, dur: 1, p0: new THREE.Vector3(), q0: new THREE.Vector3(), p1: new THREE.Vector3(), q1: new THREE.Vector3() };
    const s0 = new THREE.Spherical(), s1 = new THREE.Spherical(), off = new THREE.Vector3();
    const moveTo = (pos: THREE.Vector3, target: THREE.Vector3, dur: number) => {
      tween.p0.copy(camera.position);
      tween.q0.copy(controls.target);
      tween.p1.copy(pos);
      tween.q1.copy(target);
      tween.t = 0;
      tween.dur = dur;
      tween.on = true;
    };
    const stepTween = (dt: number) => {
      if (!tween.on) return;
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const e = ease(tween.t);
      s0.setFromVector3(off.copy(tween.p0).sub(tween.q0));
      s1.setFromVector3(off.copy(tween.p1).sub(tween.q1));
      let dth = s1.theta - s0.theta;
      dth -= Math.round(dth / (2 * Math.PI)) * 2 * Math.PI;
      s0.set(s0.radius + (s1.radius - s0.radius) * e, s0.phi + (s1.phi - s0.phi) * e, s0.theta + dth * e);
      controls.target.lerpVectors(tween.q0, tween.q1, e);
      camera.position.copy(controls.target).add(off.setFromSpherical(s0));
      if (tween.t >= 1) tween.on = false;
    };
    controls.addEventListener("start", () => (tween.on = false));
    let posed: VoiceModel | null = null;
    /** the head centre the camera was placed for (a new body moves the view with it) */
    const posedTarget = new THREE.Vector3();
    const home = () => {
      const m = feedRef.current?.model ?? model.current;
      if (m) {
        const p = r.poses(m);
        moveTo(p.home, p.target, 0.9);
      }
    };
    canvas.addEventListener("dblclick", home);

    // petting: a mouse wiggled over the top of the head (no button down: that turns the head)
    const pet = new Petting();
    let crown: { x: number; y: number; cmPx: number } | null = null;
    let lastPt: [number, number] | null = null;
    const onHover = (e: PointerEvent) => {
      if (e.buttons !== 0 || e.pointerType === "touch" || !crown) {
        lastPt = null;
        return;
      }
      const p: [number, number] = [e.offsetX, e.offsetY];
      // over the crown: within 6 cm of its top, and not below the brow
      const near = Math.hypot(p[0] - crown.x, p[1] - crown.y) < 6 * crown.cmPx && p[1] < crown.y + 4.5 * crown.cmPx;
      if (near && lastPt) pet.stroke(Math.hypot(p[0] - lastPt[0], p[1] - lastPt[1]) / crown.cmPx);
      lastPt = near ? p : null;
    };
    const offHead = () => (lastPt = null);
    canvas.addEventListener("pointermove", onHover);
    canvas.addEventListener("pointerleave", offHead);

    let w = 0, h = 0, dpr = 1;
    const maxDpr = () => Math.min(feedRef.current?.maxDpr ?? 2, window.devicePixelRatio || 1);
    /** a fed head (no settings of its own to keep) goes back to its framing when its pane changes shape */
    let refit = false;
    const fit = () => {
      const b = wrap.getBoundingClientRect();
      dpr = maxDpr();
      refit = !!feedRef.current && (b.width !== w || b.height !== h);
      w = b.width;
      h = b.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.setPixelRatio(dpr);
      gl.setSize(Math.max(1, w), Math.max(1, h), false);
      r.resize(Math.max(1, w), Math.max(1, h));
      body.resize(Math.max(1, w), Math.max(1, h));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    let raf = 0;
    let last = performance.now();
    let fTick = 0;
    let formants: number[] = [];
    let epoch = -1;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      // the face's expression keeps real time (a held note lasts as long at a low frame rate)
      const elapsed = Math.min(0.5, (now - last) / 1000);
      last = now;
      if (maxDpr() !== dpr) fit();
      const st = useStore.getState();
      const feed = feedRef.current;
      let tele: TelemetryMessage | null, a: HumanArtic;
      if (feed) {
        const fr = feed.frame();
        if (fr.epoch !== epoch) {
          epoch = fr.epoch;
          r.resetMotion();
        }
        tele = fr.tele;
        a = tele ? VoiceModel.articFromArray(tele.t.artic) : fr.artic;
      } else {
        tele = engine.latest && sameBody(engine.latest.body, st.body) ? engine.latest : null;
        a = tele ? VoiceModel.articFromArray(tele.t.artic) : st.artic;
      }
      const view = feed ? feed.view : st.view;
      r.face.content = pet.content;
      r.face.update(tele, elapsed);
      const m = feed ? feed.model : model.current;
      if (m && w > 0 && h > 0) {
        if (posed !== m) {
          const p = r.poses(m);
          if (!posed) {
            // open on the 2D view's side view, then turn to show the face
            camera.position.copy(p.side);
            controls.target.copy(p.target);
            moveTo(p.home, p.target, 1.6);
          } else {
            // another body: keep the view, centred on the new head
            off.copy(p.target).sub(posedTarget);
            camera.position.add(off);
            controls.target.add(off);
          }
          posedTarget.copy(p.target);
          posed = m;
        } else if (refit) {
          const p = r.poses(m);
          moveTo(p.home, p.target, 0.4);
        }
        refit = false;
        const settings = bodySettings.current;
        body.group.visible = settings.bodyVisible;
        if (settings.bodyVisible !== bodyFramed) {
          bodyFramed = settings.bodyVisible;
          const p = r.poses(m);
          if (bodyFramed) {
            const target = p.target.clone().add(new THREE.Vector3(0, -42 * m.tract.scale, 0));
            const direction = p.home.clone().sub(p.target).normalize();
            const distance = Math.max(250, 69 * m.tract.scale / Math.tan(camera.fov * Math.PI / 360), 38 * m.tract.scale / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
            moveTo(target.clone().add(direction.multiplyScalar(distance)), target, 0.9);
          } else moveTo(p.home, p.target, 0.9);
        }
        stepTween(dt);
        controls.update(dt);
        const f = m.frame(a);
        const readouts = readoutsRef.current;
        if (readouts && (++fTick % 4 === 0 || formants.length === 0)) formants = m.transfer(a).formants;
        r.update(m, f, a, tele, view, dt);
        if (settings.bodyVisible) body.update(now / 1000, settings.movement, settings.energy, r.neckAnchor(m), m.tract.scale, settings.hair, settings.clothing, settings.build, settings.speed, settings.variety, settings.seed);
        gl.render(r.scene, camera);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(glCanvas, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (settings.bodyVisible && w >= 400 && h >= 260) {
          // A live close-up keeps the original singing face legible while the full body is framed.
          // It uses the same animated geometry and telemetry, not a second or prerecorded head.
          const side = Math.min(190, Math.floor(w * 0.28), Math.floor(h * 0.36));
          const poses = r.poses(m);
          const direction = camera.position.clone().sub(controls.target).normalize();
          const distance = 1.15 * 15.2 * m.tract.scale / Math.tan(detailCamera.fov * Math.PI / 360);
          detailCamera.position.copy(poses.target).addScaledVector(direction, distance);
          detailCamera.lookAt(poses.target);
          detailCamera.updateProjectionMatrix();
          const fog = r.scene.fog as THREE.Fog;
          const near = fog.near, far = fog.far;
          fog.near = distance - 3 * m.tract.scale;
          fog.far = distance + 30 * m.tract.scale;
          gl.setScissorTest(true);
          gl.setScissor(0, 0, side, side);
          gl.setViewport(0, 0, side, side);
          gl.render(r.scene, detailCamera);
          gl.setScissorTest(false);
          gl.setViewport(0, 0, w, h);
          fog.near = near; fog.far = far;
          const x = w - side - 12, y = 12;
          ctx.fillStyle = "#000";
          ctx.fillRect(x, y, side, side);
          ctx.drawImage(glCanvas, 0, canvas.height - side * dpr, side * dpr, side * dpr, x, y, side, side);
          ctx.strokeStyle = "#3487c4";
          ctx.strokeRect(x + 0.5, y + 0.5, side - 1, side - 1);
          label(ctx, tele ? "LIVE FACE" : "FACE / READY", x + 8, y + 15, { size: 10, color: V.blue, ls: 0.12 });
        }
        if (r.caliper && !settings.bodyVisible) {
          const [cx, cy] = r.project(r.caliper.x, r.caliper.y, r.caliper.z);
          label(ctx, r.caliper.area <= 0.0005 ? "CLOSED" : `${r.caliper.area.toFixed(2)} CM²`, cx + 10, cy - 6, { size: 11, color: V.white, ls: 0.12 });
        }
        if (readouts && !settings.bodyVisible) {
          const info = infoRef.current(m, f, tele).map((s) => s.toUpperCase());
          const slots = slotsRef.current(m, a, f, formants, tele);
          drawReadouts(ctx, { w, h, compact: r.compact, slotX: w - Math.min(340, w * 0.42), slotY: h - Math.min(236, h * 0.3) }, formantsRef.current ? formants : [], info, slots);
        }
        if (!settings.bodyVisible) overlayRef.current?.(ctx, r.faceView(m, f, a), m, f, a, { w, h, dt });
        // the hearts start beside the crown on the side the face looks to, and drift that way
        crown = r.crown(m);
        pet.update(elapsed, [crown.x + r.facing * 7 * crown.cmPx, crown.y + 0.5 * crown.cmPx], crown.cmPx);
        if (!settings.bodyVisible) pet.draw(ctx, r.facing, crown.cmPx);
        glow.apply(canvas, ctx, dpr);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("dblclick", home);
      canvas.removeEventListener("pointermove", onHover);
      canvas.removeEventListener("pointerleave", offHead);
      controls.dispose();
      body.dispose();
      r.dispose();
      gl.dispose();
      // browsers allow few live WebGL contexts: give this one back now, not at garbage collection
      gl.forceContextLoss();
    };
  }, [model]);

  if (failed)
    return (
      <div className="anatomy three">
        <p className="no-webgl">3D needs WebGL, which this browser has turned off. Untick 3D for the flat view.</p>
      </div>
    );
  return (
    <div ref={wrapRef} className="anatomy three">
      {!props.feed && <div className="studio-motion-controls">
        <button type="button" onClick={() => setBodyVisible(!bodyVisible)}>{bodyVisible ? "HEAD VIEW" : "FULL BODY"}</button>
        {bodyVisible && <><label>Motion <select value={movement} onChange={e => setMovement(e.target.value)}><option>Liquid sway</option><option>Hands to heart</option><option>Wave</option><option>Reach</option><option>Electric pulse</option><option>Still</option></select></label><label>Hair <select value={hair} onChange={e => setHair(e.target.value)}><option>None</option><option>Long</option><option>Bob</option><option>Curls</option></select></label><label>Clothes <select value={clothing} onChange={e => setClothing(e.target.value)}><option>None</option><option>Tank top</option><option>Dress</option></select></label><label>Energy <input aria-label="Motion energy" type="range" min="0" max="1" step="0.01" value={energy} onChange={e => setEnergy(Number(e.target.value))} /></label><label>Build <input aria-label="Body build" type="range" min="0.75" max="1.3" step="0.05" value={build} onChange={e => setBuild(Number(e.target.value))} /></label><label>Speed <input aria-label="Motion speed" type="range" min="0.25" max="2" step="0.05" value={speed} onChange={e => setSpeed(Number(e.target.value))} /></label><label>Variation <input aria-label="Motion variation" type="range" min="0" max="1" step="0.05" value={variety} onChange={e => setVariety(Number(e.target.value))} /></label><button type="button" onClick={() => setSeed(v => v+1)}>NEW VARIATION</button><small>PROCEDURAL MOTION</small></>}
      </div>}
      <canvas ref={canvasRef} aria-label="Vocal tract in 3D. Drag to turn the head, scroll or pinch to zoom, double-click to go back to the starting view." role="img" />
    </div>
  );
}
