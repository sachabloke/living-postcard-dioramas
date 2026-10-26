// Lightweight floor support for manually previewed exported character clips.
// Bounds come from the recorded offline GLB pose sampler; no skinning scan runs per frame.
export function floorSupportOffset(clipProfile, seconds, targetHeight = 1.5, sampledHeight = 1.7) {
  const samples = clipProfile?.samples;
  if (!Array.isArray(samples) || samples.length === 0 || !(sampledHeight > 0)) return 0;
  const duration = Math.max(0, Number(clipProfile.duration) || 0);
  const t = clipProfile.loop && duration > 0 ? ((seconds % duration) + duration) % duration : Math.max(0, Math.min(duration, seconds));
  let right = samples.findIndex(sample => sample.seconds >= t);
  if (right < 0) right = samples.length - 1;
  const a = samples[Math.max(0, right - 1)], b = samples[right];
  const span = b.seconds - a.seconds;
  const mix = span > 0 ? Math.max(0, Math.min(1, (t - a.seconds) / span)) : 0;
  const bottom = a.bottomMeters + (b.bottomMeters - a.bottomMeters) * mix;
  return Math.max(0, -bottom) * targetHeight / sampledHeight;
}

// Locomotion loops use a steady, per-clip worst-case correction. Blending sampled
// per-frame minima here could make the avatar bob as a foot enters/exits the floor.
export function locomotionSupportOffset(idleProfile, walkProfile, walkWeight, targetHeight = 1.5, sampledHeight = 1.7) {
  if (!(sampledHeight > 0)) return 0;
  const support = profile => Number.isFinite(profile?.minBottomMeters)
    ? Math.max(0, -profile.minBottomMeters) * targetHeight / sampledHeight
    : null;
  const idle = support(idleProfile), walk = support(walkProfile);
  if (idle === null && walk === null) return 0;
  if (idle === null) return walk;
  if (walk === null) return idle;
  const weight = Math.min(1, Math.max(0, Number(walkWeight) || 0));
  return idle * (1 - weight) + walk * weight;
}

export function findRightHandBone(root) {
  return root?.getObjectByName?.('mixamorigRightHand') || root?.getObjectByName?.('mixamorig:RightHand') || root?.getObjectByName?.('RightHand') || null;
}

export function isAxeChopClip(actionName) {
  return /axe.*chop|chop.*axe/i.test(actionName || '');
}

export function actionBehavior(actionName) {
  if (/lying|lie\.down/i.test(actionName || '')) return 'hold';
  if (/idle|walk|running|craft|sleep/i.test(actionName || '')) return 'loop';
  return 'return';
}

export function shouldReturnToLocomotion(finishedAction, activeAction) {
  return !!finishedAction && finishedAction === activeAction && actionBehavior(finishedAction.getClip?.().name) === 'return';
}
