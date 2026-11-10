import * as THREE from 'three';
import { createPerformer } from '../../../../src/performer.js';

// A procedural companion to the original Chimera head, not MotionBricks output.
export function studioBody(scene) {
  const group = new THREE.Group();
  group.scale.setScalar(24);
  group.position.set(0, -64, 0);
  scene.add(group);
  const joints = {};
  for (const name of ['head','neck','chest','pelvis','ls','le','lw','rs','re','rw','lh','lk','la','rh','rk','ra']) joints[name] = {position:new THREE.Vector3()};
  const updateGeometry = createPerformer(group, joints, {showHead:false});
  group.visible = false;
  return {
    group,
    update(t, preset, energy) {
      const amplitude = energy * (preset === 'Still' ? 0 : preset === 'Electric pulse' ? 1.5 : 1);
      const s = Math.sin(t * (preset === 'Electric pulse' ? 3 : 1.5));
      const c = Math.cos(t * 1.5), sway=s*.14*amplitude;
      const p={head:[0,2.75,0],neck:[0,2.43,0],chest:[sway*.4,2.08,0],pelvis:[-sway*.25,1.38,0],ls:[-.36+sway,2.22,0],le:[-.56+sway,1.86+c*.12*amplitude,0],lw:[-.67+sway,1.55+c*.21*amplitude,.06],rs:[.36+sway,2.22,0],re:[.56+sway,1.86-c*.12*amplitude,0],rw:[.67+sway,1.55-c*.21*amplitude,.06],lh:[-.20,1.35,0],lk:[-.23+s*.10*amplitude,.73,0],la:[-.25+s*.12*amplitude,.08,.08],rh:[.20,1.35,0],rk:[.23-s*.10*amplitude,.73,0],ra:[.25-s*.12*amplitude,.08,.08]};
      for (const n in p) joints[n].position.set(...p[n]);
      updateGeometry();
    },
    dispose() { scene.remove(group); group.traverse(o=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}}); }
  };
}
