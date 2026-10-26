// Saves + parent PIN. Keys are namespaced fmr1.* so they can never collide with the old game's forestMaths* keys.
// Only synthetic test profiles exist in this build.
import { newState } from './rules.js';
export const PROFILES = {
  'synthetic-y56': { id: 'synthetic-y56', name: 'Test player (Y5/6)', band: 'y56', synthetic: true },
  'synthetic-ks3': { id: 'synthetic-ks3', name: 'Test player (KS3)', band: 'ks3', synthetic: true },
  tommy: { id: 'tommy', name: 'Tommy (Year 7)', band: 'ks3', year: 7, synthetic: false, family: true },
  charlie: { id: 'charlie', name: 'Charlie (Year 5)', band: 'y56', year: 5, synthetic: false, family: true },
  'parent-test': { id: 'parent-test', name: 'Parent (test)', band: 'y56', synthetic: true, parent: true },
};
const K = (id) => `fmr1.save.${id}`;
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
export function loadState(id) {
  const prof = PROFILES[id], raw = lsGet(K(id));
  if (raw) { try { const s = JSON.parse(raw); if (s && s.v === 1 && s.profile?.id === id) return Object.assign(newState(prof), s); } catch { /* fall through */ } }
  return newState(prof);
}
export function peekState(id) { const raw = lsGet(K(id)); try { return raw ? JSON.parse(raw) : null; } catch { return null; } }
/** A profile may only write its own key. The parent profile can never write a child's key. */
export function saveState(state, actingId) {
  if (state.profile.id !== actingId) { console.warn('refused cross-profile write', actingId, state.profile.id); return false; }
  return lsSet(K(actingId), JSON.stringify(state));
}
export function clearProfile(id) { try { localStorage.removeItem(K(id)); } catch { /* ignore */ } }

const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function digest(salt, pin) { const data = new TextEncoder().encode(salt + ':' + pin); return hex(await crypto.subtle.digest('SHA-256', data)); }
export const hasPin = () => !!lsGet('fmr1.parent');
export async function setPin(pin) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4–8 digits');
  const salt = hex(crypto.getRandomValues(new Uint8Array(12)));
  lsSet('fmr1.parent', JSON.stringify({ salt, hash: await digest(salt, pin) }));
}
export async function checkPin(pin) { try { const p = JSON.parse(lsGet('fmr1.parent')); return !!p && (await digest(p.salt, pin)) === p.hash; } catch { return false; } }
