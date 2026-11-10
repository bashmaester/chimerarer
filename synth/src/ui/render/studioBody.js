import * as THREE from 'three';
import { Beams, Poly } from './beams3d.ts';

// Anatomical vector body in Chimera coordinates: +X is forward, +Z is the
// person's right, Y is up, and the vocal folds are at the origin (body cm).
// Its upper neck follows the actual animated head's lowest shell cross-section.
export function studioBody(scene) {
  const beams = new Beams();
  scene.add(beams.group);
  const P = new Poly();
  const jointState = new Map();
  let previousTime = null;
  let blend = 1;
  let shape = null;
  let shapeEnabled = true;
  function smoothJoint(key, target) {
    let point = jointState.get(key);
    if (!point) { point = target.clone(); jointState.set(key, point); }
    else point.lerp(target, blend);
    return point.clone();
  }
  const blue = '#4fb6f2', mid = '#3487c4', dim = '#1f5f8c';
  const vec = (x,y,z) => new THREE.Vector3(x,y,z);
  function path(points, color=blue, width=.85, alpha=.7, close=false) {
    const put = (p) => {
      const f = shapeEnabled && shape ? 1+(shape.factor-1)*Math.max(0,Math.min(1,(shape.top-p.y)/8)) : 1;
      P.p(shape ? shape.x+(p.x-shape.x)*f : p.x, p.y, shape ? shape.z+(p.z-shape.z)*f : p.z);
    };
    P.reset(); for (const p of points) put(p);
    if (close && points.length) put(points[0]);
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
    update(time,preset,energy,anchor,k, hair="None", clothing="None", build=1, speed=1, variety=.4, seed=1) {
      beams.begin();
      const dt = previousTime === null ? 1 : Math.max(0, time - previousTime);
      blend = dt > .5 ? 1 : 1 - Math.exp(-dt * 7);
      previousTime = time;
      const amp = (preset === 'Still' ? 0 : preset === 'Electric pulse' ? 1.3 : .7) * energy;
      const t=time*speed, phase=seed*1.618;
      const s = (Math.sin(t*(preset === 'Electric pulse'?2.8:1.25)) + variety*.35*Math.sin(t*.53+phase))*amp;
      const c = (Math.cos(t*1.25) + variety*.35*Math.sin(t*.79+phase))*amp;
      const neck=anchor.center.clone().multiplyScalar(1/k), top=neck.y;
      shape={x:neck.x,z:neck.z,top,factor:build}; shapeEnabled=true;
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
      // Hair strands are drawn around the head's own animated neck frame.  The
      // forehead is left open so the original expressive face stays visible.
      shapeEnabled=false;
      if (hair !== 'None') {
        const hairColor = hair === 'Long' ? '#ffb96b' : hair === 'Bob' ? '#ff73cf' : '#5be381';
        const hairPoint = (x,y,z) => vec(x,y,z).applyQuaternion(anchor.rotation).add(neck);
        const long = hair === 'Long', curly = hair === 'Curls';
        for(let i=0;i<48;i++) {
          const angle = 2*Math.PI*i/48;
          // open face on +X; narrow fringe strands terminate at the hairline
          const front = Math.cos(angle) > .72;
          const pts=[];
          for(let j=0;j<=12;j++) {
            const u=j/12, theta=u*Math.PI/2;
            pts.push(hairPoint(-.5+7.2*Math.cos(angle)*Math.sin(theta), 26-7.3*(1-Math.cos(theta)), 7.8*Math.sin(angle)*Math.sin(theta)));
          }
          if(!front && !curly) {
            const end = long ? -19 : 7;
            for(let j=1;j<=18;j++) {
              const u=j/18, sway = s*.38*u*u;
              pts.push(hairPoint(-.5+7.2*Math.cos(angle)+sway, 18.7+(end-18.7)*u, 7.8*Math.sin(angle)*(1+.06*u)+sway));
            }
          }
          path(pts,hairColor,.85,i%4===0?.72:.46);
          if(curly && !front) {
            const base=hairPoint(-.5+7.2*Math.cos(angle),18.7,7.8*Math.sin(angle)), coil=[];
            for(let j=0;j<=24;j++){const a=j*Math.PI*2/24;coil.push(base.clone().add(vec(1.15*Math.cos(a),1.15*Math.sin(a),.4*Math.sin(a)).applyQuaternion(anchor.rotation)))}
            path(coil,hairColor,.85,.7);
          }
        }
      }
      shapeEnabled=true;
      // Clothing is a separate colored wire surface, not a replacement for the
      // underlying anatomy. Its rings and seams follow the swaying torso.
      if (clothing !== 'None') {
        const color = clothing === 'Dress' ? '#ff73cf' : '#5be381';
        const garment=[];
        for(let i=0;i<=15;i++){
          const u=i/15, y=top-13-u*23, rx=9.2-2.1*u, rz=16-5.3*u;
          garment.push([y,rx,rz]); oval(center(y),rx,rz,color,i===0||i===15?.9:.55);
        }
        for(let j=0;j<16;j++){
          let theta=2*Math.PI*j/16, pts=garment.map(([y,rx,rz])=>center(y).add(vec(rx*Math.cos(theta),0,rz*Math.sin(theta))));
          path(pts,color,.6,j%4===0?.6:.3);
        }
        for(const side of [-1,1]) {
          path([center(top-13).add(vec(7,0,side*8)),center(top-9).add(vec(3,0,side*12)),center(top-7).add(vec(-1,0,side*11)),center(top-13).add(vec(-6,0,side*8))],color,1,.8);
        }
        if(clothing==='Dress') {
          const skirt=[];
          for(let i=0;i<=15;i++){let u=i/15,y=top-36-u*24,rx=7.2+5*u,rz=10.8+8*u;skirt.push([y,rx,rz]);oval(center(y),rx,rz,color,i===0||i===15?.8:.37)}
          for(let j=0;j<16;j++){let a=j*Math.PI*2/16;path(skirt.map(([y,rx,rz])=>center(y).add(vec(rx*Math.cos(a),0,rz*Math.sin(a)))),color,.6,.35)}
        }
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
        // Short tapered bridge overlaps the torso shell and the upper arm so
        // the deltoid grows out of the shoulder instead of floating beside it.
        const shoulderRoot=center(top-10).add(vec(0,0,side*13));
        limb(shoulderRoot,shoulder,4.6,4.3);
        let elbow=center(top-29).add(vec(1.2*c,0,side*(20+1.2*s)));
        let wrist=center(top-45).add(vec(2*c,0,side*(21+2*s)));
        if (preset === 'Hands to heart') {
          elbow=center(top-25).add(vec(3+c,0,side*(22+s)));
          wrist=center(top-17).add(vec(10+c,0,side*(8+s)));
        } else if (preset === 'Wave') {
          elbow=center(top-20).add(vec(2+c,0,side*23));
          wrist=center(top-8).add(vec(3+c*2,0,side*(25+3*s)));
        } else if (preset === 'Reach') {
          elbow=center(top-17).add(vec(2+c,0,side*(25+s)));
          wrist=center(top-7).add(vec(2+c*2,0,side*(37+s*2)));
        }
        elbow=smoothJoint(`elbow${side}`,elbow);
        wrist=smoothJoint(`wrist${side}`,wrist);
        limb(shoulder,elbow,4.3,2.7);limb(elbow,wrist,2.7,1.8);
        const handDir=wrist.clone().sub(elbow).normalize();
        const palm=wrist.clone().addScaledVector(handDir,3.4);limb(wrist,palm,1.8,2.2,.6);
        for(let f=0;f<5;f++){const z=side*(f-2)*.8;const base=palm.clone().add(vec(.2,0,z));const tip=base.clone().addScaledVector(handDir,3.3-Math.abs(f-2)*.4);limb(base,tip,.36,.18,.8)}
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
