// Meshy "explorer" (Mixamo-rigged, one baked material): adapted from Codex's forest-character-integration handoff (23 Oct 2026).
// Trial only: parent-approved for the separate review build; not published. Appearance customisation is not supported (single baked material).
import * as THREE from 'three';
import { actionBehavior, findRightHandBone, floorSupportOffset, isAxeChopClip, locomotionSupportOffset, shouldReturnToLocomotion } from './contact.js';

export function makeExplorerFromModel(models, name, targetHeight) {
  const m = models[name]; if (!m) return null;
  const root = m.root, box = new THREE.Box3().setFromObject(root), h = box.max.y - box.min.y, k = targetHeight / h;
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(root); g.add(inner); inner.scale.setScalar(k);
  root.position.y -= box.min.y; root.position.x -= (box.min.x + box.max.x) / 2; root.position.z -= (box.min.z + box.max.z) / 2;
  root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(root), find = (re) => m.clips.find(c => re.test(c.name)) || null, walkClip = find(/walk/i) || m.clips[0], idleClip = find(/idle/i);
  const walk = walkClip ? mixer.clipAction(walkClip) : null, idle = idleClip && idleClip !== walkClip ? mixer.clipAction(idleClip) : null; if (walk) walk.play(); if (idle) idle.play();
  let ts = 0, wk = 0;
  g.userData.animate = (speed01, t, dt = 0.016) => { const moving = speed01 > 0.05; ts += ((moving ? 0.7 + speed01 * 0.8 : 0) - ts) * Math.min(1, dt * 10); wk += ((moving ? 1 : 0) - wk) * Math.min(1, dt * 9);
    if (walk) { walk.timeScale = idle ? ts : ts; walk.setEffectiveWeight(idle ? wk : 1); } if (idle) idle.setEffectiveWeight(1 - wk); mixer.update(dt); };
  const locomotionUpdate = g.userData.animate;
  let manualAction = null;
  let contactProfiles = null;
  const actions = new Map(m.clips.map(clip => [clip.name, mixer.clipAction(clip)]));
  // Preview-only axe prop: parent it to the Mixamo right hand so the chopped pose can be reviewed
  // with a tool in hand. This is visual test geometry, not a gameplay tool or production asset.
  const axe = new THREE.Group();
  axe.name = 'character-review-axe';
  // Parent review: the original ~41 cm world-space handle looked too small.
  // Parent review: 1.6x was too large; use the intermediate size.
  axe.scale.setScalar(1.3);
  const wood = new THREE.MeshStandardMaterial({ color: 0x795334, roughness: 0.82 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x7d8990, roughness: 0.48, metalness: 0.55 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.46, 8), wood);
  // Keep the hand near the lower end of the handle rather than its midpoint.
  handle.position.y = 0.175; handle.castShadow = true; axe.add(handle);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.012, 0.19); bladeShape.lineTo(-0.045, 0.205); bladeShape.lineTo(-0.16, 0.29);
  bladeShape.lineTo(-0.22, 0.32); bladeShape.lineTo(-0.205, 0.36); bladeShape.lineTo(-0.115, 0.35);
  bladeShape.lineTo(-0.035, 0.31); bladeShape.lineTo(0.012, 0.305); bladeShape.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: 0.045, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.008, bevelThickness: 0.008 }), iron);
  blade.position.set(0, 0.14, -0.0225); blade.castShadow = true; axe.add(blade);
  axe.visible = false;
  const hand = findRightHandBone(root);
  if (hand) hand.add(axe);
  g.userData.setActionProp = actionName => { axe.visible = !!hand && isAxeChopClip(actionName); };
  g.userData.clipNames = [...actions.keys()];
  g.userData.setContactProfiles = (data) => { contactProfiles = data; };
  g.userData.floorSupportOffset = () => {
    if (!contactProfiles) return 0;
    if (!manualAction) {
      const profile = name => contactProfiles.clips?.find(item => item.name === name);
      return locomotionSupportOffset(profile(idleClip?.name), profile(walkClip?.name), wk, targetHeight, contactProfiles.targetHeightMeters || 1.7);
    }
    const profile = contactProfiles.clips?.find(item => item.name === manualAction.getClip().name);
    const loop = /idle|walk|running|craft|sleep/i.test(manualAction.getClip().name);
    return floorSupportOffset(profile && { ...profile, loop }, manualAction.time, targetHeight, contactProfiles.targetHeightMeters || 1.7);
  };
  g.userData.playClip = name => {
    mixer.stopAllAction(); manualAction = name ? actions.get(name) : null;
    g.userData.setActionProp(name);
    if (manualAction) {
      const loop = actionBehavior(name) === 'loop';
      manualAction.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
      manualAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      manualAction.clampWhenFinished = !loop; manualAction.play();
    } else { if (walk) walk.reset().play(); if (idle) idle.reset().play(); ts = 0; wk = 0; }
  };
  mixer.addEventListener('finished', event => {
    // Lying down keeps its resting pose; discrete work and jump actions resume locomotion.
    if (shouldReturnToLocomotion(event.action, manualAction)) {
      g.userData.playClip(null);
    }
  });
  g.userData.animate = (speed01, t, dt = 0.016) => {
    if (manualAction) mixer.update(dt); else locomotionUpdate(speed01, t, dt);
  };
  g.userData.isModel = true; g.userData.height = targetHeight; return g;
}
