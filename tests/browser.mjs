import { chromium } from 'playwright-core';
import midiPackage from '@tonejs/midi';
const { Midi } = midiPackage;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(() => {
  const inputs=new Map();
  const port={id:'test-keyboard',name:'Test keyboard',state:'connected',onmidimessage:null};
  inputs.set(port.id,port);
  const access={inputs,onstatechange:null};
  Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>access});
  window.__fakeMidi={port,access,inputs,send:(...data)=>port.onmidimessage?.({data:new Uint8Array(data)})};
});
try {
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Start and hear a song'}).click();
  await page.waitForFunction(()=>window.__chimeraEngine?.latest?.t?.clock>0,{timeout:30000});
  const before=await page.evaluate(()=>Array.from(window.__chimeraEngine.latest.t.artic));
  await page.waitForTimeout(1500);
  const after=await page.evaluate(()=>Array.from(window.__chimeraEngine.latest.t.artic));
  if(!before.some((n,i)=>Math.abs(n-after[i])>.0001))throw Error('Singing articulation did not change');
  await page.getByRole('button',{name:'FULL BODY'}).click();
  await page.getByLabel('Motion variation').fill('0.8');
  await page.getByRole('button',{name:'Edit song / MIDI'}).click();
  const midi=new Midi();midi.header.setTempo(96);const track=midi.addTrack();track.name='Test';track.addNote({midi:60,ticks:0,durationTicks:480});track.addNote({midi:64,ticks:960,durationTicks:480});
  await page.locator('input[type=file][accept*=".mid"]').setInputFiles({name:'test.mid',mimeType:'audio/midi',buffer:Buffer.from(midi.toArray())});
  await page.getByText('Imported 2 notes.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'PLAY SONG'}).click();
  await page.getByText('Playing arrangement through the Chimera voice.').waitFor();
  await page.waitForTimeout(1000);
  await page.getByRole('button',{name:'■ STOP'}).click();
  await page.getByRole('button',{name:'Close song editor'}).click();
  await page.getByRole('button',{name:'MIDI input: Off · click to connect'}).click();
  await page.getByRole('button',{name:'MIDI input: Test keyboard'}).waitFor();
  for (const mode of ['Play','Speak','Sing','Bestiary','Beatbox']) {
    await page.getByRole('radiogroup',{name:'Mode'}).getByRole('radio',{name:mode,exact:true}).click();
    await page.getByRole('button',{name:'MIDI input: Test keyboard'}).waitFor();
    await page.evaluate(()=>window.__fakeMidi.send(0x90,64,100));
    await page.waitForFunction(async()=>{const {useStore}=await import('/synth/src/ui/store.ts');return useStore.getState().heldNotes.includes(64)});
    await page.evaluate(()=>window.__fakeMidi.send(0x80,64,0));
    await page.waitForFunction(async()=>{const {useStore}=await import('/synth/src/ui/store.ts');return !useStore.getState().heldNotes.includes(64)});
  }
  await page.evaluate(()=>window.__fakeMidi.send(0x90,65,100));
  await page.getByRole('button',{name:'MIDI input: Test keyboard'}).click();
  await page.waitForFunction(async()=>{const {useStore}=await import('/synth/src/ui/store.ts');const s=useStore.getState();return s.midi.status==='off' && !s.heldNotes.includes(65)});
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Browser smoke: live articulation, MIDI file playback and global MIDI input in all modes passed');
} finally { await browser.close(); }
