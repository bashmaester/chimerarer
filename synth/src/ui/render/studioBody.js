import * as THREE from 'three';
import { Beams, Poly } from './beams3d.ts';

// Anatomical vector body in Chimera coordinates: +X is forward, +Z is the
// person's right, Y is up, and the vocal folds are at the origin (body cm).
// Its upper neck follows the actual animated head's lowest shell cross-section.
export function studioBody(scene) {
  const beams = new Beams();
  scene.add(beams.group);
  const P = new Poly();
  const blue = '#4fb6f2', mid = '#3487c4', dim = '#1f5f8c';
  const vec = (x,y,z) => new THREE.Vector3(x,y,z);
  function path(points, color=blue, width=.85, alpha=.7, close=false) {
    P.reset(); for (const p of points) P.p(p.x,p.y,p.z);
    if (close && points.length) P.p(points[0].x,points[0].y,points[0].z);
    beams.poly(P,color,width,{alpha});
  }
  function oval(center, rx, rz, color=mid, alpha=.6, rotation=null) {
    const pts=[]; for(let i=0;i<=48;i++){let t=i*Math.PI*2/48;let p=vec(rx*Math.cos(t),0,rz*Math.sin(t));if(rotation)p.applyQuaternion(rotation);pts.push(p.add(center));}path(pts,color,.85,alpha);
  }
  // A tapered 3D surface, with circular sections and meridians rather than bones.
  function limb(a,b,r0,r1,flatten=0.82) {
    const axis=b.clone().sub(a), dir=axis.clone().normalize();
    let u=vec(1,0,0); if(Math.abs(dir.dot(u))>.9)u=vec(0,0,1);
    u.addScaledVector(dir,-u.dot(dir)).normalize(); const v=new THREE.Vector3().crossVectors(dir,u).normalize();
    const point=(t,theta)=>{let bulge=1+.14*Math.sin(Math.PI*t),r=(r0*(1-t)+r1*t)*bulge;return a.clone().addScaledVector(axis,t).addScaledVector(u,Math.cos(theta)*r).addScaledVector(v,Math.sin(theta)*r*flatten)};
    for(let i=0;i<=12;i++){const t=i/12, pts=[];for(let j=0;j<=32;j++)pts.push(point(t,j*2*Math.PI/32));path(pts,mid,.6,i%4===0?.56:.34)}
    for(let i=0;i<16;i++){const pts=[];for(let j=0;j<=12;j++)pts.push(point(j/12,i*2*Math.PI/16));path(pts,i%4===0?blue:dim,i%4===0?.85:.6,i%4===0?.65:.48)}
  }
  function segment(a,b,color=blue,width=1,alpha=.8){path([a,b],color,width,alpha)}
  return {
    group: beams.group,
    resize(w,h){beams.setResolution(w,h)},
    update(time,preset,energy,anchor,k) {
      beams.begin();
      const amp = (preset === 'Still' ? 0 : preset === 'Electric pulse' ? 1.3 : .7) * energy;
      const s = Math.sin(time*(preset === 'Electric pulse'?2.8:1.25))*amp;
      const c = Math.cos(time*1.25)*amp;
      const neck=anchor.center.clone().multiplyScalar(1/k), top=neck.y;
      // Torso proportions measured relative to the bottom of the original head.
      // Motion keeps the neck anchored while the shoulders and hips counter-sway.
      const center=(y)=>vec(neck.x + .5*s*Math.max(0,Math.min(1,(top-y)/25)),y, neck.z + .9*s*Math.max(0,Math.min(1,(top-y)/25)));
      const torso = [
        [0,anchor.depth/k,anchor.width/k],[-2,5.4,6],[-5,6.2,9],[-8,7,15],[-11,8,17],
        [-15,9,16],[-19,9.5,15],[-23,8.7,13.7],[-27,7.4,12],[-31,6.5,10.5],
        [-35,6.5,10],[-39,7,11],[-43,7.5,12],[-47,7.4,11],[-50,6,8]
      ];
      // Shell cross sections are continuous with the head's last neck ring.
      for(let i=0;i<torso.length;i++){
        const [dy,rx,rz]=torso[i];oval(center(top+dy),rx,rz,i<3?blue:mid,i<3?.72:.48,i===0?anchor.rotation:null);
      }
      for(let j=0;j<24;j++){
        const theta=j*Math.PI*2/24, points=[];
        for(let i=0;i<torso.length;i++){
          const [dy,rx,rz]=torso[i], p=vec(rx*Math.cos(theta),0,rz*Math.sin(theta));
          if(i===0)p.applyQuaternion(anchor.rotation);
          points.push(p.add(center(top+dy)));
        }
        path(points,j%6===0?blue:dim,j%6===0?1:.6,j%6===0?.7:.48);
      }
      // Sternum and individual ribs: anatomically shaped arcs inside the shell.
      const ribTop=top-10;
      segment(center(ribTop).add(vec(8.2,0,0)),center(top-25).add(vec(8.6,0,0)),blue,1.05,.8);
      for(let i=0;i<9;i++){
        const y=ribTop-2-i*1.8, widen=Math.sin((i+2)/12*Math.PI), points=[];
        for(let j=0;j<=40;j++){const theta=j*Math.PI*2/40;points.push(center(y-1.3*Math.abs(Math.sin(theta))).add(vec(7.4*Math.cos(theta),0,13*widen*Math.sin(theta))))}
        path(points, i%2?mid:blue,.85,.55);
      }
      // Vertebral column and shoulder girdle.
      for(let i=0;i<21;i++){const y=top-5-i*1.75;oval(center(y).add(vec(-5.2,0,0)),1.35,1.9,i%3?mid:blue,.65)}
      for(const side of [-1,1]){
        path([center(top-7).add(vec(5,0,0)),center(top-8).add(vec(4,-.7,side*6)),center(top-9).add(vec(1,-1,side*14)),center(top-10).add(vec(-1,-1,side*17))],blue,1.05,.8);
        path([center(top-16).add(vec(-6,0,side*3)),center(top-13).add(vec(-6,0,side*11)),center(top-10).add(vec(-1,-1,side*17)),center(top-20).add(vec(-4,0,side*9)),center(top-16).add(vec(-6,0,side*3))],mid,.85,.65);
        const shoulder=center(top-11).add(vec(0,0,side*17));
        const elbow=center(top-29).add(vec(1.2*c,0,side*(20+1.2*s)));
        const wrist=center(top-45).add(vec(2*c,0,side*(21+2*s)));
        limb(shoulder,elbow,4.3,2.7);limb(elbow,wrist,2.7,1.8);
        const palm=wrist.clone().add(vec(1,-3.4,side*.4));limb(wrist,palm,1.8,2.2,.6);
        for(let f=0;f<5;f++){const z=side*(f-2)*.8;const base=palm.clone().add(vec(.2,0,z));const tip=base.clone().add(vec(.4,-(3.3-Math.abs(f-2)*.4),side*.35));limb(base,tip,.36,.18,.8)}
        const hip=center(top-46).add(vec(0,0,side*6));
        const knee=center(top-69).add(vec(1+1.0*s,0,side*7));
        const ankle=center(top-92).add(vec(-.5+1.4*s,0,side*7));
        limb(hip,knee,5.5,3.5);limb(knee,ankle,3.5,2);
        const toe=ankle.clone().add(vec(7,-2,0));limb(ankle,toe,2,1.7,.75);
        // Pelvic bowl and femoral landmarks.
        path([center(top-39).add(vec(-4,0,side*5)),center(top-41).add(vec(-2,0,side*11)),center(top-47).add(vec(2,0,side*9)),center(top-50).add(vec(5,0,side*3)),center(top-48).add(vec(5,0,0))],blue,1,.65);
      }
      // All geometry above is expressed in body cm relative to the head.
      beams.group.scale.setScalar(k);
      beams.end();
    },
    dispose(){scene.remove(beams.group);beams.dispose()}
  };
}
