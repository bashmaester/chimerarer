import { createServer } from 'vite';
import * as THREE from 'three';
const server=await createServer({server:{middlewareMode:true}});
const {sameBody}=await server.ssrLoadModule('/synth/src/ui/body.ts');
const {studioBody}=await server.ssrLoadModule('/synth/src/ui/render/studioBody.js');
if(!sameBody({female:0.3,child:0.1},{female:Math.fround(.3),child:Math.fround(.1)}))throw new Error('telemetry precision mismatch');
if(sameBody({female:.3,child:.1},{female:.4,child:.1}))throw new Error('different body accepted');
const scene=new THREE.Scene(), body=studioBody(scene);body.resize(800,600);
const anchor={center:new THREE.Vector3(0,-5,0),width:5,depth:5,rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,0,.1))};
let time=1;
for(const hair of ['None','Long','Bob','Curls']) for(const clothing of ['None','Tank top','Dress']) for(const motion of ['Still','Liquid sway','Electric pulse','Hands to heart','Reach']) {
body.update(time+=.016,motion,.65,anchor,1,hair,clothing);
for(const mesh of body.group.children){if(mesh.visible){const pos=mesh.geometry.getAttribute('instanceStart');for(let i=0;i<mesh.geometry.instanceCount;i++)if(!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i)))throw Error(`invalid geometry: ${motion} ${hair} ${clothing}`)}}
}
console.log('Telemetry matching and procedural geometry checks passed');body.dispose();await server.close();
