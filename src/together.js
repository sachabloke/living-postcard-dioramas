// Play together: two devices, one world (the same seed). A short code introduces them through /api/signal; after that positions and
// builds go straight between the devices (a WebRTC data channel). Only the character choice, positions and placed builds are sent: no names, no maths.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const api = async (body) => {
  const r = await fetch('/api/signal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(j.error || 'Playing together is not switched on yet'), { status: r.status });
  return j;
};
const gathered = (pc) => new Promise(res => {
  if (pc.iceGatheringState === 'complete') return res();
  const done = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', done); res(); } };
  pc.addEventListener('icegatheringstatechange', done); setTimeout(res, 5000);       // a slow network still gets whatever was found so far
});

/** onState(name, extra): 'waiting' (extra = code), 'joining', 'connected', 'closed', 'error'. onMessage(obj) gets each message from the other device. */
export function createTogether({ onState, onMessage }) {
  let pc = null, dc = null, poll = null, giveUp = null, everOpen = false, seen = { host: 0, srflx: 0, relay: 0 }, lost = null;
  const state = (s, x) => { try { onState(s, x); } catch {} };
  const stop = () => { clearInterval(poll); clearTimeout(giveUp); poll = giveUp = null; };
  const gone = () => { clearTimeout(lost); lost = null; if (everOpen) state('closed'); else { const n = `${seen.host} local, ${seen.srflx} public, ${seen.relay} relay`; close(); state('error', `Could not connect (${n}). Try the same Wi-Fi, or start a new game.`); } };
  const wire = (ch) => { dc = ch; ch.onopen = () => { everOpen = true; stop(); clearTimeout(lost); state('connected'); }; ch.onclose = gone; ch.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} }; };
  const fresh = () => {
    close(); everOpen = false; seen = { host: 0, srflx: 0, relay: 0 }; pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (e) => { const t = e.candidate && e.candidate.type; if (t && seen[t] !== undefined) seen[t]++; };
    pc.onconnectionstatechange = () => { const c = pc && pc.connectionState; if (c === 'failed') gone(); else if (c === 'disconnected') { clearTimeout(lost); lost = setTimeout(gone, 8000); } else if (c === 'connected') clearTimeout(lost); };   // a brief wobble is not "left"
    return pc;
  };
  function close() { stop(); clearTimeout(lost); try { if (dc) { dc.onclose = null; dc.close(); } } catch {} try { if (pc) { pc.onconnectionstatechange = null; pc.close(); } } catch {} dc = pc = null; }
  async function host() {
    try {
      fresh(); wire(pc.createDataChannel('fm'));
      await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
      const { code } = await api({ op: 'host', offer: pc.localDescription.toJSON() }); state('waiting', code);
      poll = setInterval(async () => { try { const { answer } = await api({ op: 'poll', code }); if (answer && pc) { clearInterval(poll); await pc.setRemoteDescription(answer); } } catch (e) { if (e.status === 404) { stop(); state('error', 'The game closed. Start a new one.'); } } }, 1500);
      giveUp = setTimeout(() => { if (!dc || dc.readyState !== 'open') { close(); state('error', 'Nobody joined. Start a new game.'); } }, 10 * 60 * 1000);
    } catch (e) { close(); state('error', e.message); }
  }
  async function join(code) {
    code = String(code || '').trim().toUpperCase();
    try {
      const { offer } = await api({ op: 'join', code }); fresh(); pc.ondatachannel = (e) => wire(e.channel);
      await pc.setRemoteDescription(offer); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
      state('joining'); await api({ op: 'answer', code, answer: pc.localDescription.toJSON() });
      giveUp = setTimeout(() => { if (!dc || dc.readyState !== 'open') { close(); state('error', 'Could not connect. Try again, or try on the same Wi-Fi.'); } }, 20000);
    } catch (e) { close(); state('error', e.message); }
  }
  const send = (o) => { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(o)); };
  return { host, join, send, close, get connected() { return !!dc && dc.readyState === 'open'; } };
}
