import { useStore } from '../store.ts';
import { midiSupported } from '../midi.ts';

/** The connection is global: switching modes never unmounts MIDI input. */
export function MidiButton() {
  const midi = useStore(s => s.midi);
  const setMidi = useStore(s => s.setMidi);
  const supported = midiSupported();
  const on = midi.status === 'on';
  const connecting = midi.status === 'connecting';
  const status = !supported ? 'Not supported' : connecting ? 'Connecting…' : midi.status === 'denied' ? 'Access blocked · retry' : on ? (midi.inputs.length ? midi.inputs.join(', ') : 'No input connected') : 'Off · click to connect';
  const title = !supported ? 'Web MIDI requires a supported browser and HTTPS.' : connecting ? 'Cancel MIDI connection' : on ? `Connected inputs: ${midi.inputs.join(', ') || 'none'}. Click to disconnect.` : 'Connect MIDI input (your browser will ask for permission).';
  return <button type="button" className={`midi global-midi${on ? ' on' : ''}`} aria-label={`MIDI input: ${status}`} aria-pressed={on} disabled={!supported} title={title} onClick={() => setMidi(!(on || connecting))}>
    <span className="midi-name">MIDI IN</span><span className="midi-status">{status}</span>
  </button>;
}
