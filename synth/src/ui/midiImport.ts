import type { Midi } from '@tonejs/midi';
import type { EditorNote } from './singing.ts';
const snap=(n:number)=>Math.round(n*4)/4;
/** Import a single track as a monophonic, quarter-beat-quantized voice. */
export function importMidiTrack(file:Midi,index:number,makeId:()=>string):{notes:EditorNote[]; adjusted:number} {
  const track=file.tracks[index];
  if (!track || !Number.isFinite(file.header.ppq) || file.header.ppq<=0) throw new Error('Invalid MIDI track');
  const source=[...track.notes].sort((a,b)=>a.ticks-b.ticks || b.midi-a.midi);
  let adjusted=0;const notes:EditorNote[]=[];
  for(const n of source) {
    const start=snap(n.ticks/file.header.ppq), end=snap((n.ticks+n.durationTicks)/file.header.ppq);
    if(start>=256 || notes.length>=256){adjusted++;continue}
    if(notes.length && start<notes[notes.length-1].start+notes[notes.length-1].beats){
      const previous=notes[notes.length-1];
      if(start<=previous.start){adjusted++;continue}
      previous.beats=start-previous.start; adjusted++;
    }
    notes.push({id:makeId(),midi:Math.max(36,Math.min(84,n.midi)),start:Math.max(0,start),beats:Math.min(256-start,Math.max(.25,end-start)),word:'ah'});
  }
  return {notes,adjusted};
}
