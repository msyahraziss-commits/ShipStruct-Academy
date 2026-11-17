import { TOPICS,REFERENCES } from './motion-data.mjs';
import { MODES,MOTION_IDS,EFFECT_IDS,makeState,phaseAt,setAmplitude,setPeriod,setPhase,advance,applyPreset,samplePose,primaryValue,clamp } from './motion-core.mjs';
import { MotionRenderer } from './motion-renderer.mjs';

const app=document.getElementById('app');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let state,renderer,resizeObserver,animationFrame,lastTimestamp,traceData;
const lastTopic={'Ship motions':'roll','Hull effects':'panting'};
const topic=()=>TOPICS.find(item=>item.id===state.mode);
const el=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=(value,digits=1)=>`${Math.abs(value)<.05?'':value>0?'+':'−'}${Math.abs(value)<.05?(0).toFixed(digits):Math.abs(value).toFixed(digits)}`;
function range(id,label,value,min,max,step,unit,help='') {
  return `<div class="range-control"><div class="range-heading"><label for="${id}">${label}</label><output id="${id}-output" for="${id}">${Number(value).toFixed(step<1?1:0)}${unit==='°'?'°':' '+unit}</output></div><input class="input-range" type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" ${help?`aria-describedby="${id}-help"`:''}><div class="range-scale"><span>${min}${unit==='°'?'°':unit==='m'?' m':''}</span><span>${max}${unit==='°'?'°':unit==='m'?' m':''}</span></div>${help?`<p class="control-note" id="${id}-help">${help}</p>`:''}</div>`;
}
function amplitudeControls() {
  if(state.mode==='combined')return `<label class="preset-control" for="teaching-preset">Teaching examples<select id="teaching-preset"><option value="custom">Custom mix</option><option value="head">Head-sea example</option><option value="beam">Beam-sea example</option><option value="quartering">Quartering-sea example</option><option value="still">Still-water reference</option></select></label><div class="combined-sliders">${MOTION_IDS.map(id=>{
    const item=TOPICS.find(item=>item.id===id);
    return `<div>${range(`amp-${id}`,item.short+' amplitude',state.amplitudes[id],0,item.max,item.step,item.unit)}<p class="channel-live" id="live-${id}"></p></div>`;
  }).join('')}</div><div class="control-actions"><button data-action="zero">Zero all motions</button><button data-action="mix">Default mix</button></div><p class="control-note">All six components share the cycle period below, with different phases for comparison.</p>`;
  return `<p class="control-subtitle">${MOTION_IDS.includes(state.mode)?'Use the slider on the model to adjust amplitude: the maximum departure from its reference position.':'Use the slider on the model to adjust the magnified effect. This level is not a measured strain or pressure.'}</p>`;
}
function sceneControl() {
  const combined=state.mode==='combined',structural=EFFECT_IDS.includes(state.mode),item=TOPICS.find(t=>t.id===(combined?state.activeComponent:state.mode));
  const id=combined?'focus-amplitude':structural?'effect-intensity':`amp-${state.mode}`;
  const value=structural?state.flex:state.amplitudes[item.id],unit=structural?' / 5':item.unit==='°'?'°':' m';
  return `<div class="scene-control ${combined?'has-component':''}">${combined?`<label class="component-select" for="focus-component">Adjust component<select id="focus-component">${MOTION_IDS.map(id=>`<option value="${id}" ${id===state.activeComponent?'selected':''}>${TOPICS.find(t=>t.id===id).short}</option>`).join('')}</select></label>`:''}<div class="scene-knob"><div class="range-heading"><label for="${id}" id="focus-label">${combined?item.short+' amplitude':structural?'Effect intensity':item.name+' amplitude'}</label><output id="${id}-output" for="${id}">${Number(value).toFixed(structural||item.step<1?1:0)}${unit}</output></div><input class="input-range" type="range" id="${id}" min="0" max="${structural?5:item.max}" step="${structural?.1:item.step}" value="${value}"></div></div>`;
}
function controls() {
  return `<aside class="lab-controls" aria-label="Simulation controls"><section class="control-card"><h3>${state.mode==='combined'?'Motion mix':'Timing & display'}</h3><div id="amplitude-controls">${amplitudeControls()}</div><div class="control-divider"></div>${range('cycle-period','Cycle period',state.period,2,20,.5,'s')}<label class="rate-select" for="playback-speed">Playback speed<select id="playback-speed"><option value="0.25" ${state.speed===.25?'selected':''}>0.25×</option><option value="0.5" ${state.speed===.5?'selected':''}>0.5×</option><option value="1" ${state.speed===1?'selected':''}>1× normal</option><option value="1.5" ${state.speed===1.5?'selected':''}>1.5×</option><option value="2" ${state.speed===2?'selected':''}>2×</option></select></label><div class="layer-options"><label><input type="checkbox" id="show-axes" ${state.axes?'checked':''}>Reference axes</label><label><input type="checkbox" id="show-reference" ${state.reference?'checked':''}>Reference hull</label><label><input type="checkbox" id="show-cutaway" ${state.cutaway?'checked':''}>Structural cutaway</label></div><div class="control-actions"><button data-action="reset">Reset this scene</button></div></section><details class="control-card wave-options"><summary>Waves & camera</summary><label class="wave-check"><input type="checkbox" id="show-waves" ${state.waves?'checked':''}>Show wave pattern</label>${range('wave-height','Visual wave height',state.waveHeight,0,3,.1,'m')}${range('wave-heading','Wave approach direction',state.waveHeading,0,360,15,'°')}<p class="control-note">0° = from the reference bow · 90° = starboard beam · 180° = aft · 270° = port beam. The arrow shows wave travel.</p><p class="control-note">The wave pattern and prescribed ship motions are adjustable separately. This lab does not calculate a vessel’s response to a sea state.</p><div class="control-divider" style="margin-top:17px"></div>${range('camera-angle','Orbit view',0,-180,180,5,'°')}${range('camera-height','Tilt view',0,-15,40,1,'°')}</details></aside>`;
}
function render() {
  cancelAnimationFrame(animationFrame);lastTimestamp=null;resizeObserver?.disconnect();
  const item=topic(),structural=EFFECT_IDS.includes(item.id),group=item.group;
  app.innerHTML=`<div class="lab-title"><div><span class="eyebrow">THE SHIP MOTION LAB</span><h1>See how a ship moves.</h1><p>Isolate a motion, change its strength and pause any part of the cycle. Then explore how the hull itself can flex.</p></div><div class="lab-mark" aria-hidden="true">≈</div></div><div class="topic-toolbar"><div class="topic-groups" aria-label="Topic group"><button data-group="Ship motions" aria-pressed="${group==='Ship motions'}">Ship motions</button><button data-group="Hull effects" aria-pressed="${group==='Hull effects'}">Hull effects</button></div><span class="topic-count">6 motions · 7 hull effects</span></div><nav class="topic-picker" aria-label="Choose a motion or hull effect">${TOPICS.filter(t=>t.group===group).map(t=>`<a class="topic-choice ${structural?'structural':''}" href="#${t.id}" ${t.id===state.mode?'aria-current="true"':''}><span class="topic-symbol" aria-hidden="true">${t.symbol}</span><span>${t.short}</span></a>`).join('')}</nav>
    <div class="lab-workspace"><div class="lab-left"><section class="viewer-card" aria-labelledby="topic-title"><div class="viewer-header"><div><span class="eyebrow">${item.kind.toUpperCase()}</span><h2 id="topic-title">${item.name}</h2></div><span class="live-badge ${state.playing?'':'paused'}" id="play-state">${state.playing?'PLAYING':'PAUSED'}</span></div><div class="canvas-wrap"><canvas id="motion-canvas" class="motion-canvas" role="img" aria-label="Animated teaching model showing ${item.name.toLowerCase()}" aria-describedby="viewer-help motion-definition"></canvas><span class="scene-badge ${structural?'flex-badge':''}">${structural?'HULL EFFECT · MAGNIFIED':'ILLUSTRATIVE CARGO VESSEL'}</span>${sceneControl()}<span class="paused-hint" id="paused-hint" ${state.playing?'hidden':''}>Paused · move the cycle slider to inspect</span></div><div class="viewer-help" id="viewer-help">${item.axis}: ${item.direction}</div><div class="transport"><button class="btn" data-action="play" id="play-button">${state.playing?'Pause':'Play'}</button><button class="btn secondary" data-action="step">Step +15°</button><button class="btn ghost" data-action="restart">Restart cycle</button><div class="phase-value"><small>CYCLE POSITION</small><span id="phase-value">0°</span></div></div><div class="phase-control"><label for="cycle-position" class="sr-only">Cycle position</label><input class="input-range" type="range" id="cycle-position" min="0" max="360" step="1" value="0" aria-describedby="cycle-position-help"><div class="phase-ticks" aria-hidden="true"><span>0°</span><span>90°</span><span>180°</span><span>270°</span><span>360°</span></div><span class="sr-only" id="cycle-position-help">Changing the cycle position pauses the animation.</span></div><div class="view-tools"><label class="view-select" for="camera-view">View<select id="camera-view">${[['perspective','Perspective'],['side','Side view'],['end','End view'],['top','Top view'],['bow','Bow close-up']].map(([id,name])=>`<option value="${id}" ${state.view===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="zoom-control" for="view-zoom">Zoom<input class="input-range" type="range" id="view-zoom" min="0.7" max="1.5" step="0.05" value="${state.zoom}"></label></div><div class="axis-key"><span><i></i>Longitudinal</span><span class="transverse"><i></i>Transverse</span><span class="vertical"><i></i>Vertical</span></div></section><div class="value-strip"><div class="motion-stat"><small id="current-label">${structural?'Relative flex':state.mode==='combined'?'Current roll':'Current motion'}</small><strong id="current-value">0</strong><span id="current-description"></span></div><div class="motion-stat"><small>${structural?'Illustration level':state.mode==='combined'?'Active components':'Amplitude'}</small><strong id="amplitude-value"></strong><span>${structural?'Flex exaggerated':state.mode==='combined'?'Independently adjustable':'Maximum from reference'}</span></div><div class="motion-stat"><small>Cycle period</small><strong id="period-value"></strong><span>Simulation seconds</span></div></div><div class="motion-trace"><div class="trace-heading"><h3>One cycle</h3><span id="trace-component">${state.mode==='combined'?'Roll component':state.mode==='slamming'?'Vertical movement':structural?'Relative effect':'Motion from reference'}</span></div><svg id="cycle-trace" viewBox="0 0 600 90" role="img" aria-label="One full cycle with a marker at the current animation position"><path d="M0 45H600" stroke="#4b7084" stroke-width="1" stroke-dasharray="4 5"/><path id="trace-line" fill="none" stroke="#5adeba" stroke-width="2.5"/><path id="trace-cursor" d="M0 6V84" stroke="#edc37a" stroke-width="1" opacity=".7"/><circle id="trace-dot" r="4" fill="#ffdc94" stroke="#143547" stroke-width="2"/></svg><p class="trace-note">Relative scale · the marker follows the cycle slider. ${state.mode==='combined'?'The six components are combined with different phases.':''}</p></div><section class="observation-card"><span class="eyebrow">WHAT TO NOTICE</span><h3>${item.name}: ${item.axis.toLowerCase()}</h3><p class="definition" id="motion-definition">${item.description}</p><div class="observation-grid"><div><h4>FOLLOW THIS</h4><p>${item.watch}</p></div><div><h4>MAKE THE DISTINCTION</h4><p>${item.compare}</p></div></div><a class="text-link" href="index.html#lesson/${item.lesson}">Open the related course lesson →</a></section></div>${controls()}</div>
    <div class="lab-overview"><section class="overview-card"><span class="eyebrow">SIX DEGREES OF FREEDOM</span><h3>Three rotations. Three translations.</h3><table class="motion-table"><thead><tr><th>Axis</th><th>Rotation</th><th>Translation</th></tr></thead><tbody><tr><td>Longitudinal</td><td><a href="#roll">Roll</a></td><td><a href="#surge">Surge</a></td></tr><tr><td>Transverse</td><td><a href="#pitch">Pitch</a></td><td><a href="#sway">Sway</a></td></tr><tr><td>Vertical</td><td><a href="#yaw">Yaw</a></td><td><a href="#heave">Heave</a></td></tr></tbody></table></section><section class="overview-card"><span class="eyebrow">MOVEMENT & STRUCTURE</span><h3>The ship can move. Its hull can also flex.</h3><p>Use the reference outline to tell the difference. A rigid-body motion preserves the shape of the hull. A structural effect changes the shape of a plate, a section or the hull girder.</p><p><a class="text-link" href="#panting">Compare panting</a> · <a class="text-link" href="#racking">Compare racking</a></p></section></div><details class="motion-reference" id="references"><summary>Learning references & model notes</summary><ul>${REFERENCES.map(ref=>`<li><a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.title}</a><span>${ref.detail}</span></li>`).join('')}</ul><p class="model-note">This is an original schematic teaching model with prescribed motion, illustrative wave geometry and magnified hull deformation. The reference axes remain fixed at the model’s starting position. It does not compute ship stability, seakeeping response, structural stress, damage thresholds or safe operating limits.</p></details>`;
  renderer=new MotionRenderer(el('motion-canvas'));
  resizeObserver=new ResizeObserver(()=>{renderer.resize();draw();});resizeObserver.observe(el('motion-canvas'));
  renderer.resize();buildTrace();draw();schedule();
}
function currentDescription(pose) {
  const mode=state.mode==='combined'?state.activeComponent:state.mode;
  const near=value=>Math.abs(value)<.05;
  if(mode==='roll')return near(pose.roll)?'Reference angle':pose.roll>0?'Starboard side down':'Port side down';
  if(mode==='pitch')return near(pose.pitch)?'Reference angle':pose.pitch>0?'Bow up':'Bow down';
  if(mode==='yaw')return near(pose.yaw)?'Reference heading':pose.yaw>0?'Bow toward port':'Bow toward starboard';
  if(mode==='heave')return near(pose.heave)?'Reference height':pose.heave>0?'Above reference':'Below reference';
  if(mode==='sway')return near(pose.sway)?'Reference position':pose.sway>0?'Toward port':'Toward starboard';
  if(mode==='surge')return near(pose.surge)?'Reference position':pose.surge>0?'Forward of reference':'Aft of reference';
  if(state.mode==='panting')return near(pose.flex)?'Reference shell shape':pose.flex>0?'Shell flexed outward':'Shell flexed inward';
  if(state.mode==='racking')return near(pose.flex)?'Reference section':pose.flex>0?'Upper section toward port':'Upper section toward starboard';
  if(state.mode==='hogging')return 'Deck tension · bottom compression';
  if(state.mode==='sagging')return 'Deck compression · bottom tension';
  if(state.mode==='torsion')return 'Opposite twist along the hull';
  if(state.mode==='slamming')return pose.impact>.1?'Illustrated impact':Math.cos(pose.phase*Math.PI*2)>0?'Forebody rising':'Forebody descending';
  return pose.phase<.18?'Before the impulse':'Decaying hull vibration';
}
function updateReadouts(pose) {
  const item=topic(),structural=EFFECT_IDS.includes(state.mode),value=primaryValue(state,pose),unitItem=state.mode==='combined'?TOPICS.find(t=>t.id===state.activeComponent):item;
  const degrees=Math.round(!state.playing&&state.manualPhase!==null?state.manualPhase:pose.phase*360);
  el('phase-value').textContent=`${degrees}°`;
  el('cycle-position').value=String(degrees);
  let current=structural?`${signed(value*100,0)}%`:`${signed(value)}${unitItem.unit==='°'?'°':' m'}`;
  if(state.mode==='combined')el('current-label').textContent='Current '+unitItem.short.toLowerCase();
  if(state.mode==='slamming'){current=`${signed(value)} m`;el('current-label').textContent='Vertical motion';}
  el('current-value').textContent=current;el('current-description').textContent=currentDescription(pose);
  el('amplitude-value').textContent=state.mode==='combined'?`${MOTION_IDS.filter(id=>state.amplitudes[id]>0).length} / 6`:structural?`${state.flex.toFixed(1)} / 5`:`${Number(state.amplitudes[state.mode]).toFixed(item.step<1?1:0)}${item.unit==='°'?'°':' m'}`;
  el('period-value').textContent=`${state.period.toFixed(1)} s`;
  for(const id of MOTION_IDS){const node=el(`live-${id}`);if(node)node.textContent=`Now ${signed(pose[id])}${['roll','pitch','yaw'].includes(id)?'°':' m'}`;}
  el('trace-cursor').setAttribute('d',`M${degrees/360*600} 6V84`);
  el('trace-dot').setAttribute('cx',String(degrees/360*600));el('trace-dot').setAttribute('cy',String(45-primaryValue(state,pose)/traceData.scale*31));
}
function buildTrace() {
  const samples=Array.from({length:121},(_,i)=>primaryValue(state,samplePose(state,i/120*state.period)));
  const scale=Math.max(.001,...samples.map(Math.abs));traceData={scale};
  el('trace-line').setAttribute('d',samples.map((value,i)=>`${i===0?'M':'L'}${i*5} ${45-value/scale*31}`).join(' '));
}
function updateTransport() {
  const badge=el('play-state');badge.textContent=state.playing?'PLAYING':'PAUSED';badge.classList.toggle('paused',!state.playing);
  el('play-button').textContent=state.playing?'Pause':'Play';el('paused-hint').hidden=state.playing;
}
function draw(){if(!renderer)return;const pose=renderer.draw(state);updateReadouts(pose||samplePose(state));updateTransport();}
function schedule(){cancelAnimationFrame(animationFrame);lastTimestamp=null;if(state.playing&&!document.hidden)animationFrame=requestAnimationFrame(tick);}
function tick(timestamp){
  if(!state.playing||document.hidden)return;
  if(lastTimestamp===null)lastTimestamp=timestamp;
  if(timestamp-lastTimestamp>=1000/30){advance(state,(timestamp-lastTimestamp)/1000);lastTimestamp=timestamp;draw();}
  animationFrame=requestAnimationFrame(tick);
}
function chooseMode(id,reset=false) {
  if(!MODES.includes(id))id='roll';
  const previous=state;state=makeState(id);
  if(previous&&!reset){state.amplitudes={...previous.amplitudes};state.period=previous.period;state.speed=previous.speed;state.playing=previous.playing;}
  else state.playing=!reducedMotion.matches;
  if(reset&&previous)state.playing=previous.playing;
  lastTopic[topic().group]=id;render();
  el('announcer').textContent=`${topic().name}. ${topic().description}`;
}
function updateAmplitudeOutputs() {
  const ids=state.mode==='combined'?MOTION_IDS:MOTION_IDS.includes(state.mode)?[state.mode]:[];
  for(const id of ids){const item=TOPICS.find(t=>t.id===id),input=el(`amp-${id}`),output=el(`amp-${id}-output`);if(input)input.value=state.amplitudes[id];if(output)output.textContent=`${state.amplitudes[id].toFixed(item.step<1?1:0)}${item.unit==='°'?'°':' m'}`;}
  if(state.mode==='combined'){
    const item=TOPICS.find(t=>t.id===state.activeComponent),input=el('focus-amplitude');
    input.max=item.max;input.step=item.step;input.value=state.amplitudes[item.id];
    el('focus-label').textContent=item.short+' amplitude';el('focus-amplitude-output').textContent=`${state.amplitudes[item.id].toFixed(item.step<1?1:0)}${item.unit==='°'?'°':' m'}`;
    el('trace-component').textContent=item.short+' component';
  }
}
app.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.group){const id=lastTopic[button.dataset.group];if(state.mode===id)return;location.hash=id;return;}
  const action=button.dataset.action;
  if(action==='play'){state.playing=!state.playing;if(state.playing)state.manualPhase=null;draw();schedule();}
  if(action==='step'){setPhase(state,(phaseAt(state.time,state.period)*360+15)%360);draw();schedule();}
  if(action==='restart'){state.time=0;state.manualPhase=0;draw();}
  if(action==='reset'){chooseMode(state.mode,true);}
  if(action==='zero'||action==='mix'){
    for(const id of MOTION_IDS)setAmplitude(state,id,action==='zero'?0:makeState().amplitudes[id]);
    el('teaching-preset').value='custom';updateAmplitudeOutputs();buildTrace();draw();
  }
});
app.addEventListener('input',event=>{
  const input=event.target,id=input.id,value=Number(input.value);
  if(id.startsWith('amp-')){setAmplitude(state,id.slice(4),value);updateAmplitudeOutputs();if(el('teaching-preset'))el('teaching-preset').value='custom';buildTrace();}
  else if(id==='focus-amplitude'){setAmplitude(state,state.activeComponent,value);updateAmplitudeOutputs();el('teaching-preset').value='custom';buildTrace();}
  else if(id==='effect-intensity'){state.flex=clamp(value,0,5);el(`${id}-output`).textContent=`${state.flex.toFixed(1)} / 5`;buildTrace();}
  else if(id==='cycle-period'){setPeriod(state,value);el(`${id}-output`).textContent=`${state.period.toFixed(1)} s`;buildTrace();}
  else if(id==='cycle-position'){setPhase(state,value);schedule();}
  else if(id==='view-zoom')state.zoom=clamp(value,.7,1.5);
  else if(id==='wave-height'){state.waveHeight=clamp(value,0,3);el(`${id}-output`).textContent=`${state.waveHeight.toFixed(1)} m`;buildTrace();}
  else if(id==='wave-heading'){state.waveHeading=clamp(value,0,360);el(`${id}-output`).textContent=`${state.waveHeading}°`;buildTrace();}
  else if(id==='camera-angle'){state.azimuthOffset=clamp(value,-180,180);el(`${id}-output`).textContent=`${state.azimuthOffset}°`;}
  else if(id==='camera-height'){state.elevationOffset=clamp(value,-15,40);el(`${id}-output`).textContent=`${state.elevationOffset}°`;}
  draw();
});
app.addEventListener('change',event=>{
  const input=event.target,id=input.id;
  if(id==='focus-component'){state.activeComponent=input.value;updateAmplitudeOutputs();buildTrace();}
  if(id==='playback-speed'){state.speed=clamp(input.value,.25,2);schedule();}
  if(id==='camera-view'){state.view=input.value;state.azimuthOffset=0;state.elevationOffset=0;for(const name of ['camera-angle','camera-height']){el(name).value=0;el(`${name}-output`).textContent='0°';}}
  if(id==='teaching-preset'&&applyPreset(state,input.value)){
    updateAmplitudeOutputs();el('wave-height').value=state.waveHeight;el('wave-height-output').textContent=`${state.waveHeight.toFixed(1)} m`;el('wave-heading').value=state.waveHeading;el('wave-heading-output').textContent=`${state.waveHeading}°`;buildTrace();
  }
  if(id==='show-axes')state.axes=input.checked;
  if(id==='show-reference')state.reference=input.checked;
  if(id==='show-cutaway')state.cutaway=input.checked;
  if(id==='show-waves'){state.waves=input.checked;buildTrace();}
  draw();
});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();el('main').focus({preventScroll:true});});
function openReferences(){const reference=el('references');reference.open=true;reference.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth'});}
document.getElementById('references-link').addEventListener('click',event=>{event.preventDefault();openReferences();});
window.addEventListener('hashchange',()=>{
  const id=location.hash.slice(1);if(id==='references'){openReferences();return;}
  chooseMode(id);el('main').focus({preventScroll:true});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(animationFrame);lastTimestamp=null;}else schedule();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(animationFrame);resizeObserver?.disconnect();});
window.addEventListener('pageshow',event=>{if(event.persisted)render();});
reducedMotion.addEventListener('change',event=>{if(event.matches){state.playing=false;draw();schedule();}});
chooseMode(location.hash.slice(1));
if(location.hash==='#references')openReferences();
