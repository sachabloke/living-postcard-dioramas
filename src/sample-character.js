import * as THREE from 'three';
import {GLTFLoader} from '../vendor/three/loaders/GLTFLoader.js';
import {floorSupportOffset} from './contact.js';
export const SAMPLE_ACTIONS={Idle01:'Idle',Walk01_Forward:'Walk',Run01_Forward:'Run',FishingThrow01:'Cast fishing rod',Fishing01_Loop:'Wait for a bite',FishingFighting01:'Play the fish',FishingPullOut01:'Pull out the catch',HammeringGround01_R_Loop:'Hammer continuously'};
export const SAMPLE_PRESETS={
 'boy-12':{label:'Boy · age 12',height:1.50,directory:'woodland-boy-12'},
 'girl-12':{label:'Girl · age 12',height:1.48,directory:'woodland-girl-12'},
 woman:{label:'Adult woman',height:1.66,directory:'woodland-woman'},
 man:{label:'Adult man',height:1.76,directory:'woodland-man'}
};
const files={Fishing01_Loop:'Fishing01-Loop',HammeringGround01_R_Loop:'HammeringGround01_R-Loop'};
const loops=new Set(['Idle01','Walk01_Forward','Run01_Forward','Fishing01_Loop','HammeringGround01_R_Loop']);
export async function loadSampleCharacter({appearance='woodland',preset='boy-12',base='./assets/models/'}={}){
 const config=SAMPLE_PRESETS[preset]||SAMPLE_PRESETS['boy-12'];
 const directory=appearance==='mannequin'?'kevin-crafting':appearance==='legacy'?'woodland-sample':config.directory;
 const loader=new GLTFLoader(),clips=[];let root;
 for(const name of Object.keys(SAMPLE_ACTIONS)){const gltf=await loader.loadAsync(base+directory+'/'+(files[name]||name)+'.glb?v=variants-1');root??=(gltf.scene.getObjectByName('HumanM_BodyMesh')||gltf.scene.getObjectByName('HumanF_BodyMesh'))?gltf.scene:null;const clip=gltf.animations[0].clone();clip.name=name;clips.push(clip);}
 if(!root)throw new Error('Sample mannequin missing');
 const profiles=await fetch(base+directory+'/contact.json').then(r=>{if(!r.ok)throw new Error('Sample contact data unavailable');return r.json();});
 return{root,clips,profiles,preset:config};
}
export function makeSampleAvatar(data,targetHeight=data.preset?.height||1.5){
 const root=data.root;root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root,true),scale=targetHeight/(bounds.max.y-bounds.min.y);
 const avatar=new THREE.Group(),inner=new THREE.Group(),anchor=new THREE.Group();inner.scale.setScalar(scale);anchor.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);anchor.add(root);inner.add(anchor);avatar.add(inner);
 const bodyMeshes=[];root.traverse(o=>{if(o.isMesh){bodyMeshes.push(o);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 const mixer=new THREE.AnimationMixer(root),actions=new Map(data.clips.map(c=>[c.name,mixer.clipAction(c)]));
 const slot=root.getObjectByName('B-handPropR');if(!slot)throw new Error('Sample hand attachment missing');
 const wood=new THREE.MeshStandardMaterial({color:'#815c37'}),iron=new THREE.MeshStandardMaterial({color:'#7b8688',roughness:.5});
 const hammer=new THREE.Group(),rod=new THREE.Group();hammer.name='sample-review-hammer';rod.name='sample-review-rod';
 const handle=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.45,10),wood);handle.position.y=.12;hammer.add(handle);const head=new THREE.Mesh(new THREE.BoxGeometry(.18,.09,.09),iron);head.position.y=.32;hammer.add(head);
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,1.5,10),wood);shaft.position.y=.65;rod.add(shaft);const reel=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.04,12),iron);reel.rotation.z=Math.PI/2;reel.position.set(.04,.08,0);rod.add(reel);
 slot.add(hammer,rod);avatar.updateMatrixWorld(true);const slotScale=slot.getWorldScale(new THREE.Vector3());for(const p of [hammer,rod])p.scale.set(scale/slotScale.x,scale/slotScale.y,scale/slotScale.z);
 let manual=null,current=null,moving='';
 function props(name=''){hammer.visible=name.startsWith('Hammer');rod.visible=name.startsWith('Fishing');}
 function locomotion(speed){const name=speed>.75?'Run01_Forward':speed>.05?'Walk01_Forward':'Idle01';if(name===moving&&current)return;const next=actions.get(name);next.reset().setLoop(THREE.LoopRepeat,Infinity).play();if(current&&current!==next)next.crossFadeFrom(current,.15,false);current=next;moving=name;props();}
 avatar.userData.playClip=name=>{if(name&&!actions.has(name))return false;mixer.stopAllAction();manual=name?actions.get(name):null;props(name||'');if(manual){manual.reset().setLoop(loops.has(name)?THREE.LoopRepeat:THREE.LoopOnce,loops.has(name)?Infinity:1);manual.clampWhenFinished=!loops.has(name);manual.play();current=manual;}else{current=null;moving='';locomotion(0);}return true;};
 mixer.addEventListener('finished',e=>{if(e.action===manual)avatar.userData.playClip(e.action.getClip().name.startsWith('Fishing')?'Fishing01_Loop':null);});
 avatar.userData.animate=(speed,t,dt=.016)=>{if(manual&&speed>.05)avatar.userData.playClip(null);if(!manual)locomotion(speed);mixer.update(dt);};
 avatar.userData.floorSupportOffset=()=>{const a=manual||current,p=data.profiles?.clips.find(p=>p.name===a?.getClip().name);return p?floorSupportOffset({...p,loop:loops.has(p.name)},a.time,targetHeight,data.profiles?.targetHeightMeters||1.5):0;};
 avatar.userData.clipNames=[...actions.keys()];avatar.userData.clipLabels=SAMPLE_ACTIONS;avatar.userData.height=targetHeight;avatar.userData.character=data.preset?.label||'Woodland explorer sample';avatar.userData.isModel=true;
 avatar.userData.gameplayActions={build:'HammeringGround01_R_Loop'};
 avatar.userData.review={root,inner,mixer,actions,bodyMeshes,props:{hammer,rod},scale};
 avatar.userData.playClip(null);return avatar;
}
