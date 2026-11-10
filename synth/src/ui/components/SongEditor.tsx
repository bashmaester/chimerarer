import { useEffect, useMemo, useRef, useState } from 'react';
import { importMidiTrack } from '../midiImport.ts';
import { lyricsToSyllables } from '../../wasm/engine.ts';
import { Midi } from '@tonejs/midi';
import { DEMO_SONGS, playArrangement, stopSinging, type EditorNote } from '../singing.ts';
import { useStore } from '../store.ts';

const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const label=(n:number)=>`${names[n%12]}${Math.floor(n/12)-1}`;
const id=()=>crypto.randomUUID();
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const snap=(n:number)=>Math.round(n*4)/4;
const ROW=19, BEAT=48, MIN=36, MAX=84, LEFT=48;

export function SongEditor({close}:{close:()=>void}) {
  const body=useStore(s=>s.body), start=useStore(s=>s.start), started=useStore(s=>s.started);
  const [saved] = useState(() => { try { const x=JSON.parse(localStorage.getItem('chimera-arrangement-v1')||'null'); return x && Array.isArray(x.notes) && x.notes.every((n:EditorNote)=>typeof n.id==='string' && Number.isFinite(n.midi) && Number.isFinite(n.start) && Number.isFinite(n.beats) && typeof n.word==='string' && n.midi>=MIN && n.midi<=MAX && n.start>=0 && n.start<=256 && n.beats>=.25 && n.start+n.beats<=256) ? x : null; } catch { return null; } });
  const [notes,setNotes]=useState<EditorNote[]>(()=>saved?.notes ?? [{id:id(),midi:60,start:0,beats:1,word:'hello'},{id:id(),midi:64,start:1,beats:1,word:'ah'},{id:id(),midi:67,start:2,beats:2,word:'air'}]);
  const [selected,setSelected]=useState<string|null>(notes[0].id);
  const [bpm,setBpm]=useState<number>(clamp(Number(saved?.bpm)||100,40,240)), [message,setMessage]=useState('Click the grid to add a note. Drag a note to move it.');
  const [midi,setMidi]=useState<Midi|null>(null), [track,setTrack]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const gridRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(gridRef.current)gridRef.current.scrollTop=(MAX-68)*ROW},[]);
  useEffect(()=>{try {localStorage.setItem('chimera-arrangement-v1',JSON.stringify({notes,bpm}))}catch { /* editing remains available if storage is full */ }},[notes,bpm]);
  const note=notes.find(n=>n.id===selected);
  const span=Math.max(16,Math.ceil(Math.max(0,...notes.map(n=>n.start+n.beats))/4)*4+4);
  const sorted=useMemo(()=>[...notes].sort((a,b)=>a.start-b.start),[notes]);
  const overlap=sorted.some((n,i)=>i>0 && n.start < sorted[i-1].start+sorted[i-1].beats-1e-6);
  function change(p:Partial<EditorNote>){setNotes(ns=>ns.map(n=>n.id===selected?{...n,...p}:n))}
  function importTrack(file:Midi,index:number){
    const {notes:out,adjusted:clipped}=importMidiTrack(file,index,id);
    setNotes(out);setSelected(out[0]?.id??null);
    setMessage(`Imported ${out.length} notes. ${clipped?`${clipped} overlaps or extra notes adjusted. `:''}One voice plays one note at a time; pitches outside C2–C6 were clamped. Add syllables below. Only the first tempo is used; notes past beat 256 are omitted.`);
  }
  async function loadFile(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return;
    try {const parsed=new Midi(await file.arrayBuffer());const index=parsed.tracks.findIndex(t=>t.notes.length>0);if(index<0)throw Error('No notes found');setMidi(parsed);setTrack(String(index));setBpm(clamp(Math.round(parsed.header.tempos[0]?.bpm||120),40,240));importTrack(parsed,index)}
    catch(err){setMessage(`Could not import MIDI: ${err instanceof Error?err.message:'invalid file'}`)}
    e.target.value='';
  }
  function loadDemo(){const song=DEMO_SONGS[0];let at=0;const words=lyricsToSyllables(song.lyrics).map(s=>s.text);const list=song.notes.map((n,i)=>{const result={id:id(),midi:clamp(n[0],MIN,MAX),start:at,beats:n[1],word:words[i%words.length]};at+=n[1];return result});setNotes(list);setBpm(song.bpm);setSelected(list[0]?.id??null);setMessage('Demo melody loaded. Edit the syllable for each note.');}
  async function play(){if(!notes.length){setMessage('Add a note first.');return}if(overlap){setMessage('Notes overlap. Move or shorten them for this single voice.');return}setMessage('Playing arrangement through the Chimera voice.');try {await playArrangement(sorted,bpm,body,start);if(!useStore.getState().started)setMessage('Audio could not start. Check browser audio permissions.')} catch(e) {setMessage(e instanceof Error?e.message:'Could not play song.')} }
  function drag(e:React.PointerEvent, n:EditorNote){
    e.stopPropagation();e.preventDefault();setSelected(n.id);const x=e.clientX,y=e.clientY;const target=e.currentTarget as HTMLElement;target.setPointerCapture(e.pointerId);
    const move=(ev:PointerEvent)=>setNotes(ns=>ns.map(item=>item.id===n.id?{...item,start:clamp(snap(n.start+(ev.clientX-x)/BEAT),0,256-n.beats),midi:clamp(n.midi-Math.round((ev.clientY-y)/ROW),MIN,MAX)}:item));
    const end=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end)};
    target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);
  }
  return <div className="song-modal" role="dialog" aria-modal="true" aria-label="Song editor"><div className="song-editor">
    <header><div><b>SONG EDITOR</b><span> MIDI · MELODY · WORDS </span></div><button onClick={close} aria-label="Close song editor">✕</button></header>
    <div className="song-toolbar"><button onClick={play}>▶ PLAY SONG</button><button onClick={()=>{stopSinging();setMessage('Stopped.')}}>■ STOP</button><button onClick={()=>fileRef.current?.click()}>IMPORT MIDI</button><input ref={fileRef} type="file" accept=".mid,.midi,audio/midi" hidden onChange={loadFile}/><button onClick={loadDemo}>LOAD DEMO</button><button onClick={()=>{setNotes([]);setSelected(null)}}>CLEAR</button><label> BPM <input type="number" min="40" max="240" value={bpm} onChange={e=>setBpm(clamp(Number(e.target.value)||40,40,240))}/></label>
    {midi&&<label> TRACK <select value={track} onChange={e=>{setTrack(e.target.value);importTrack(midi,Number(e.target.value))}}>{midi.tracks.map((t,i)=>t.notes.length?<option key={i} value={i}>{t.name||`Track ${i+1}`} ({t.notes.length})</option>:null)}</select></label>}</div>
    <p className="song-status" role="status">{overlap?'⚠ Overlapping notes: this synth is monophonic. ':''}{message}{!started?' Audio starts when you play.':''}</p>
    <div className="song-grid-scroll" ref={gridRef}><div className="song-grid" style={{width:LEFT+span*BEAT,height:(MAX-MIN+1)*ROW}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const x=e.clientX-r.left-LEFT;if(x<0)return;const n={id:id(),midi:clamp(MAX-Math.floor((e.clientY-r.top)/ROW),MIN,MAX),start:clamp(snap(x/BEAT),0,255),beats:1,word:'ah'};setNotes(v=>[...v,n]);setSelected(n.id)}}>
      {Array.from({length:MAX-MIN+1},(_,i)=>{let pitch=MAX-i;return <div key={pitch} className={`song-row ${[1,3,6,8,10].includes(pitch%12)?'black':''}`} style={{top:i*ROW,height:ROW}}><span>{pitch%12===0?label(pitch):''}</span></div>})}
      {Array.from({length:span+1},(_,i)=><div key={i} className={`song-beat ${i%4===0?'bar':''}`} style={{left:LEFT+i*BEAT}}>{i%4===0&&<span>{i/4+1}</span>}</div>)}
      {notes.map(n=><div key={n.id} role="button" tabIndex={0} aria-label={`${label(n.midi)} at beat ${n.start}, ${n.word}`} className={`song-note ${n.id===selected?'selected':''}`} style={{left:LEFT+n.start*BEAT,top:(MAX-n.midi)*ROW+1,width:Math.max(8,n.beats*BEAT-2),height:ROW-2}} onPointerDown={e=>drag(e,n)} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Enter')setSelected(n.id)}}>{n.word} · {label(n.midi)}</div>)}
    </div></div>
    <div className="song-inspector">{note?<><b>SELECTED NOTE</b><label>Pitch <input type="number" min={MIN} max={MAX} value={note.midi} onChange={e=>change({midi:clamp(Number(e.target.value)||MIN,MIN,MAX)})}/><span>{label(note.midi)}</span></label><label>Start <input type="number" min="0" max="255" step="0.25" value={note.start} onChange={e=>change({start:clamp(Number(e.target.value)||0,0,256-note.beats)})}/></label><label>Beats <input type="number" min="0.25" max="256" step="0.25" value={note.beats} onChange={e=>change({beats:clamp(Number(e.target.value)||.25,.25,256-note.start)})}/></label><label>Syllable <input className="word-input" value={note.word} onChange={e=>change({word:e.target.value})} onKeyDown={e=>e.stopPropagation()}/></label><button onClick={()=>{setNotes(ns=>ns.filter(n=>n.id!==selected));setSelected(null)}}>DELETE NOTE</button><small>One syllable per note; longer words use their first syllable.</small></>:<span>Select a note to edit pitch, timing, and syllable.</span>}</div>
  </div></div>;
}
