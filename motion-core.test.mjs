import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { MOTION_IDS,EFFECT_IDS,MODES,makeState,setAmplitude,samplePose,deformPoint,rotateAndTranslate,phaseAt,setPeriod,setPhase,advance,applyPreset,waveZ,hullBottom,cameraFor,project } from './motion-core.mjs';
import {TOPICS} from './motion-data.mjs';
const close=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('six isolated rigid-body motions use the correct translation or rotation, without changing hull shape',()=>{
  const a=[25,4,2],b=[-20,-3,-2];
  for(const id of MOTION_IDS){
    const state=makeState(id);state.time=state.period/4;const pose=samplePose(state);
    close(pose[id],state.amplitudes[id]);
    for(const other of MOTION_IDS.filter(other=>other!==id))close(pose[other],0);
    close(distance(deformPoint(a,state),deformPoint(b,state)),distance(a,b));
  }
  const pitch=makeState('pitch');pitch.time=2;assert.ok(deformPoint([10,0,0],pitch)[2]>0);
  const yaw=makeState('yaw');yaw.time=2;assert.ok(deformPoint([10,0,0],yaw)[1]>0);
  const heave=makeState('heave');heave.time=2;assert.deepEqual(deformPoint([0,0,0],heave),[0,0,2]);
});
test('zero amplitudes / intensity return every mode to the undeformed reference',()=>{
  for(const id of MODES){
    const state=makeState(id);state.time=2;state.flex=0;for(const motion of MOTION_IDS)setAmplitude(state,motion,0);
    const a=[22,3,1],b=deformPoint(a,state);a.forEach((value,index)=>close(value,b[index]));close(samplePose(state).impact,0);
  }
});
test('panting flexes the fore-end sides while preserving the midship and aft sections',()=>{
  const state=makeState('panting');state.time=2;
  assert.ok(deformPoint([24,4,0],state)[1]>4);
  assert.deepEqual(deformPoint([0,6,0],state),[0,6,0]);assert.deepEqual(deformPoint([-24,4,0],state),[-24,4,0]);
  state.time=6;assert.ok(deformPoint([24,4,0],state)[1]<4);
});
test('racking changes the upper section relative to the bottom, rather than applying a rigid roll',()=>{
  const state=makeState('racking');state.time=2;
  const bottom=[0,5,-3.8],deck=[0,5,2.8];
  assert.deepEqual(deformPoint(bottom,state),bottom);assert.ok(deformPoint(deck,state)[1]>deck[1]);
  assert.notEqual(distance(deformPoint(deck,state),deformPoint(bottom,state)),distance(deck,bottom));
  close(samplePose(state).roll,0);
});
test('hogging and sagging move the centre in opposite directions while the endpoints remain referenced',()=>{
  for(const [id,sign] of [['hogging',1],['sagging',-1]]){
    const state=makeState(id);
    for(const time of [0,2,4,6]){
      state.time=time;assert.ok(deformPoint([0,0,0],state)[2]*sign>0);
      close(deformPoint([-32,0,0],state)[2],0);close(deformPoint([32,0,0],state)[2],0);
    }
  }
});
test('torsion gives opposite fore and aft twist; the centre section stays untwisted',()=>{
  const state=makeState('torsion');state.time=2;
  assert.ok(deformPoint([25,5,0],state)[2]>0);assert.ok(deformPoint([-25,5,0],state)[2]<0);
  assert.deepEqual(deformPoint([0,5,0],state),[0,5,0]);close(samplePose(state).roll,0);
});
test('period changes preserve phase, controls clamp safely and paused time cannot advance',()=>{
  const state=makeState();state.time=2;setPeriod(state,16);close(state.time,4);close(phaseAt(state.time,state.period),.25);
  setAmplitude(state,'roll',1000);close(state.amplitudes.roll,30);setAmplitude(state,'heave',-20);close(state.amplitudes.heave,0);
  setPhase(state,90);assert.equal(state.playing,false);const paused=state.time;advance(state,1);close(state.time,paused);
  state.playing=true;state.speed=2;advance(state,.05);close(state.time,paused+.1);
  close(phaseAt(16,8),0);close(phaseAt(-2,8),.75);setPeriod(state,0);close(state.period,2);
  setPhase(state,360);close(state.manualPhase,360);close(phaseAt(state.time,state.period),0);
});
test('combined examples keep independent controls, and the visual wave layer can be flat or hidden',()=>{
  const state=makeState('combined');applyPreset(state,'beam');assert.equal(state.amplitudes.roll,17);assert.equal(state.waveHeading,90);
  setAmplitude(state,'roll',4);const another=makeState('combined');applyPreset(another,'beam');assert.equal(another.amplitudes.roll,17);
  applyPreset(state,'still');for(const motion of MOTION_IDS)close(samplePose(state,2)[motion],0);close(waveZ(12,4,state,2),0);
  state.waveHeight=2;state.waves=false;close(waveZ(12,4,state,2),0);state.waves=true;assert.notEqual(waveZ(12,4,state,2),0);
});
test('slamming marks downward water contact and whipping vibrates with a decaying envelope after an impulse',()=>{
  const slam=makeState('slamming');let impacts=0,emerged=false;
  for(let i=0;i<720;i++){
    const time=i/720*slam.period,pose=samplePose(slam,time),foot=rotateAndTranslate([27,0,hullBottom(27)],pose);
    const gap=foot[2]-waveZ(foot[0],foot[1],slam,time);if(gap>0)emerged=true;
    if(pose.impact>.05){impacts++;assert.ok(Math.cos(pose.phase*Math.PI*2)<0);assert.ok(Math.abs(gap)<.65);}
  }
  assert.ok(emerged);assert.ok(impacts>0);
  const whip=makeState('whipping');close(samplePose(whip,.1*whip.period).flex,0);
  const early=Array.from({length:60},(_,i)=>Math.abs(samplePose(whip,(.2+i/300)*whip.period).flex));
  const late=Array.from({length:60},(_,i)=>Math.abs(samplePose(whip,(.75+i/300)*whip.period).flex));
  assert.ok(Math.max(...early)>Math.max(...late)*2);
});
test('all topics link to real course lessons and camera projections remain finite in every view',()=>{
  const index=readFileSync(new URL('./index.html',import.meta.url),'utf8'),lessons=new Set([...index.matchAll(/makeLesson\('([^']+)'/g)].map(match=>match[1]));
  assert.deepEqual(TOPICS.map(item=>item.id),MODES);assert.equal(EFFECT_IDS.length,7);
  for(const topic of TOPICS){assert.ok(lessons.has(topic.lesson),topic.lesson);assert.ok(topic.description&&topic.watch&&topic.compare);}
  for(const view of ['perspective','side','end','top','bow']){const state=makeState();state.view=view;const p=project([30,6,10],cameraFor(state),375,330);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.depth));}
});
