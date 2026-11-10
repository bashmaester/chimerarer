import * as THREE from 'three';

// Vector-display anatomy, using Chimera's blue/amber/pink palette. These procedural
// meshes follow the same joints as the motion rig; they are not the upstream head.
export function createPerformer(rig, joints, { showHead = true } = {}) {
  const blue = 0x4fb6f2, dim = 0x3487c4, pink = 0xff73cf, amber = 0xffb340, white = 0xeef6f8;
  function line(parent, points, color=blue, opacity=.8, closed=false) {
    if (closed) points = [...points, points[0]];
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
    const result = new THREE.Line(geometry, new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false})); parent.add(result); return result;
  }
  function oval(parent, rx, ry, z=0, color=blue, opacity=.7, cx=0, cy=0) {
    const p=[]; for(let i=0;i<=64;i++){const a=i*Math.PI*2/64;p.push([cx+rx*Math.cos(a),cy+ry*Math.sin(a),z])}return line(parent,p,color,opacity);
  }
  function globe(parent, rx, ry, rz, color=blue) {
    for(let j=1;j<12;j++){let lat=-Math.PI/2+j*Math.PI/12, p=[];for(let i=0;i<=64;i++){let a=i*Math.PI*2/64;p.push([rx*Math.cos(lat)*Math.cos(a),ry*Math.sin(lat),rz*Math.cos(lat)*Math.sin(a)])}line(parent,p,color,j%3===0?.75:.4)}
    for(let j=0;j<12;j++){let a=j*Math.PI/12,p=[];for(let i=0;i<=64;i++){let t=i*Math.PI*2/64;p.push([rx*Math.cos(t)*Math.cos(a),ry*Math.sin(t),rz*Math.cos(t)*Math.sin(a)])}line(parent,p,color,j%3===0?.65:.3)}
  }
  const head=new THREE.Group();rig.add(head);head.visible = showHead;globe(head,.25,.32,.215);
  // Eye sockets, brows, nose, lips and the inner vocal tract make the head read as
  // a face as well as a transparent cutaway when it turns.
  for(const sign of [-1,1]){
    oval(head,.068,.038,.191,white,.9,sign*.105,.07);oval(head,.022,.023,.203,amber,.95,sign*.105,.07);
    line(head,[[sign*.04,.135,.19],[sign*.09,.158,.19],[sign*.16,.15,.16],[sign*.2,.12,.12]],blue,.9);
    oval(head,.038,.072,.005,blue,.7,sign*.245,0);
    line(head,[[sign*.18,.025,.14],[sign*.2,-.05,.12],[sign*.16,-.13,.15],[sign*.09,-.2,.16],[0,-.235,.16]],dim,.8);
  }
  line(head,[[0,.11,.21],[-.025,-.025,.245],[0,-.055,.26],[.035,-.035,.23]],pink,.85);
  oval(head,.082,.026,.202,pink,.9,0,-.115);line(head,[[-.08,-.115,.205],[0,-.127,.22],[.08,-.115,.205]],amber,.85);
  // Cutaway: concentric airway and tongue strokes visible through the shell.
  for(let i=0;i<5;i++){const x=(i-2)*.014;line(head,[[x,-.03,.01],[x-.035,-.10,.015],[x-.05,-.16,.01],[x-.035,-.24,0],[x,-.32,0]],i===2?amber:pink,.65)}
  for(let i=0;i<4;i++) oval(head,.12-i*.018,.065-i*.008,.04,amber,.42,0,-.11);
  const torso=new THREE.Group();rig.add(torso);globe(torso,.36,.47,.20,dim);
  // Rib cage, sternum, collarbones, pelvis and spine.
  for(let i=0;i<9;i++){let y=.28-i*.065, w=.32*Math.sqrt(Math.max(.1,1-((y-.02)/.47)**2)); let p=[];for(let j=0;j<=40;j++){let a=j*Math.PI*2/40;p.push([w*Math.cos(a),y-.025*Math.abs(Math.cos(a)),.18*Math.sin(a)])}line(torso,p,i%3===0?blue:dim,.7)}
  line(torso,[[0,.37,.18],[0,.22,.2],[0,-.05,.2],[0,-.22,.13]],white,.7);
  line(torso,[[-.35,.29,0],[-.2,.35,.13],[0,.29,.18],[.2,.35,.13],[.35,.29,0]],blue,.9);
  for(let i=0;i<8;i++)oval(torso,.035,.018,-.12,amber,.55,0,.26-i*.07);
  const pelvis=new THREE.Group();rig.add(pelvis);globe(pelvis,.28,.17,.16,blue);for(const s of [-1,1]){oval(pelvis,.12,.085,.12,pink,.55,s*.13,0);line(pelvis,[[0,-.13,.08],[s*.1,-.16,.08],[s*.23,-.08,.06]],blue,.8)}
  // Limbs are tapered, ribbed volumes instead of single bones. Each is oriented
  // between the animated joints every frame.
  function limb(a,b,r1,r2,color=blue){const group=new THREE.Group();rig.add(group);for(let j=0;j<8;j++){let t=j/7, r=r1*(1-t)+r2*t, pts=[];for(let k=0;k<=24;k++){let q=k*Math.PI*2/24;pts.push([r*Math.cos(q),t,r*.8*Math.sin(q)])}line(group,pts,color,j===0||j===7?.85:.45)}for(let j=0;j<12;j++){let q=j*Math.PI*2/12;line(group,[[r1*Math.cos(q),0,r1*.8*Math.sin(q)],[r2*Math.cos(q),1,r2*.8*Math.sin(q)]],color,j%3===0?.75:.35)}return {group,a,b}}
  const limbs=[limb('ls','le',.13,.09),limb('le','lw',.09,.055),limb('rs','re',.13,.09),limb('re','rw',.09,.055),limb('lh','lk',.16,.105),limb('lk','la',.105,.06),limb('rh','rk',.16,.105),limb('rk','ra',.105,.06)];
  const hands=[];for(const side of [-1,1]){let h=new THREE.Group();rig.add(h);globe(h,.065,.09,.035,blue);for(let i=0;i<5;i++){let x=(i-2)*.026;line(h,[[x,-.04,0],[x*1.15,-.105,0],[x*1.25,-.16+(Math.abs(i-2)*.013),.01]],i===0?pink:blue,.9)}hands.push(h)}
  const feet=[];for(let i=0;i<2;i++){let f=new THREE.Group();rig.add(f);globe(f,.09,.045,.17,blue);for(let n=0;n<4;n++)line(f,[[(-1.5+n)*.035,0,.03],[(-1.5+n)*.035,0,.16]],dim,.7);feet.push(f)}
  return function update(){head.position.copy(joints.head.position);torso.position.copy(joints.chest.position).add(new THREE.Vector3(0,-.13,0));pelvis.position.copy(joints.pelvis.position);for(const {group,a,b} of limbs){const d=new THREE.Vector3().subVectors(joints[b].position,joints[a].position);group.position.copy(joints[a].position);group.scale.y=d.length();group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())}hands[0].position.copy(joints.lw.position);hands[1].position.copy(joints.rw.position);feet[0].position.copy(joints.la.position).add(new THREE.Vector3(0,0,.08));feet[1].position.copy(joints.ra.position).add(new THREE.Vector3(0,0,.08))};
}
