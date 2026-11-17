export const TAU = Math.PI * 2;
export const RAD = Math.PI / 180;
export const MOTION_IDS = ['roll','pitch','yaw','heave','sway','surge'];
export const EFFECT_IDS = ['panting','racking','hogging','sagging','torsion','slamming','whipping'];
export const MODES = [...MOTION_IDS,'combined',...EFFECT_IDS];
export const LIMITS = { roll:30, pitch:15, yaw:20, heave:4, sway:5, surge:5 };
export const DEFAULT_AMPLITUDES = { roll:12, pitch:5, yaw:7, heave:2, sway:2.5, surge:2.5 };
export const VIEWS = {
  perspective:{azimuth:-55,elevation:24,focus:[0,0,0],zoom:1},
  side:{azimuth:-90,elevation:5,focus:[0,0,0],zoom:1},
  end:{azimuth:0,elevation:8,focus:[0,0,0],zoom:1.7},
  top:{azimuth:-90,elevation:89,focus:[0,0,0],zoom:1},
  bow:{azimuth:-27,elevation:18,focus:[23,0,0],zoom:2.1}
};
export const PRESETS = {
  head:{ amplitudes:{roll:1,pitch:7,yaw:1,heave:2,sway:.3,surge:1.5},waveHeading:0,waveHeight:1.6 },
  beam:{ amplitudes:{roll:17,pitch:1,yaw:2,heave:1.3,sway:3,surge:.3},waveHeading:90,waveHeight:1.6 },
  quartering:{ amplitudes:{roll:12,pitch:5,yaw:5,heave:1.6,sway:1.5,surge:1},waveHeading:45,waveHeight:1.5 },
  still:{ amplitudes:{roll:0,pitch:0,yaw:0,heave:0,sway:0,surge:0},waveHeading:0,waveHeight:0 }
};
export function clamp(value,min,max) { return Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):min)); }
export function phaseAt(time,period) { return ((time/clamp(period,2,20))%1+1)%1; }
export function makeState(mode='roll') {
  if(!MODES.includes(mode))mode='roll';
  const defaultView={yaw:'top',pitch:'side',panting:'bow',racking:'end',hogging:'side',sagging:'side',slamming:'side',whipping:'side'}[mode]||'perspective';
  return {mode,activeComponent:'roll',amplitudes:{...DEFAULT_AMPLITUDES},flex:3,period:8,speed:1,time:0,manualPhase:null,playing:true,view:defaultView,zoom:1,azimuthOffset:0,elevationOffset:0,axes:true,reference:true,cutaway:mode==='panting'||mode==='racking',waves:true,waveHeight:mode==='panting'?1:1.2,waveHeading:['roll','sway','racking'].includes(mode)?90:0};
}
export function setAmplitude(state,id,value) {
  if(!MOTION_IDS.includes(id))return;
  state.amplitudes[id]=clamp(value,0,LIMITS[id]);
}
export function applyPreset(state,id) {
  const preset=PRESETS[id];if(!preset)return false;
  state.amplitudes={...preset.amplitudes};state.waveHeading=preset.waveHeading;state.waveHeight=preset.waveHeight;state.time=0;state.manualPhase=0;return true;
}
export function setPeriod(state,value) {
  const phase=phaseAt(state.time,state.period);state.period=clamp(value,2,20);state.time=phase*state.period;
}
export function setPhase(state,degrees) { state.manualPhase=clamp(degrees,0,360);state.time=state.manualPhase/360*state.period;state.playing=false; }
export function advance(state,realSeconds) {
  if(state.playing){state.manualPhase=null;state.time+=clamp(realSeconds,0,.1)*clamp(state.speed,.25,2);}
  // Keep phase arithmetic precise during long teaching sessions.
  if(state.time>state.period*1000)state.time%=state.period;
}
export function samplePose(state,time=state.time) {
  const phase=phaseAt(time,state.period),angle=phase*TAU;
  const pose={roll:0,pitch:0,yaw:0,heave:0,sway:0,surge:0,phase,flex:0,impact:0};
  if(state.mode==='combined') {
    const offsets={roll:0,pitch:.7,yaw:1.3,heave:Math.PI/2,sway:.45,surge:1.1};
    for(const id of MOTION_IDS)pose[id]=clamp(state.amplitudes[id],0,LIMITS[id])*Math.sin(angle+offsets[id]);
  } else if(MOTION_IDS.includes(state.mode))pose[state.mode]=clamp(state.amplitudes[state.mode],0,LIMITS[state.mode])*Math.sin(angle);
  else {
    const amount=clamp(state.flex,0,5)/5;
    pose.flex=amount*Math.sin(angle);
    if(['hogging','sagging'].includes(state.mode))pose.flex=amount*(.62+.38*Math.sin(angle));
    if(state.mode==='slamming') {
      // A prescribed emergence / re-entry sequence, not a hydrodynamic solver.
      pose.heave=amount*2.7*Math.sin(angle);pose.pitch=amount*7*Math.sin(angle);
      const foot=rotateAndTranslate([27,0,hullBottom(27)],pose);
      const gap=foot[2]-waveZ(foot[0],foot[1],state,time);
      pose.impact=Math.cos(angle)<-.1?amount*Math.max(0,1-Math.abs(gap)/.65):0;
    }
    if(state.mode==='whipping') {
      const sinceImpact=phase>=.18?phase-.18:0;
      pose.flex=phase<.18?0:amount*Math.exp(-sinceImpact*5)*Math.sin(sinceImpact*TAU*7);
      pose.impact=amount*Math.max(0,1-Math.abs(phase-.18)/.035);
    }
  }
  return pose;
}
export function hullWidth(x) {
  const u=x/32;
  if(u>.6)return 6*Math.max(.025,Math.cos((u-.6)/.4*Math.PI/2));
  if(u<-.8)return 6*(.35+.65*(u+1)/.2);
  return 6;
}
export function hullDeck(x) { return 2.8+Math.max(0,(x/32-.55)/.45)*1.2+Math.max(0,(-x/32-.75)/.25)*.4; }
export function hullBottom(x) { return -3.8+Math.max(0,(x/32-.65)/.35)*3.5; }
export function deformPoint(point,state,pose=samplePose(state)) {
  let [x,y,z]=point;
  const centreShape=Math.max(0,1-(x/32)**2);
  if(state.mode==='panting') {
    // Local side-shell flexing at the fore end; midships and aft are unchanged.
    const fore=Math.max(0,Math.min(1,(x-13)/12));
    const vertical=Math.exp(-(((z+.2)/3.4)**2));
    y*=1+pose.flex*.22*fore*vertical;
  }
  if(state.mode==='racking') y+=pose.flex*2.4*clamp((z+3.8)/6.6,0,1);
  if(state.mode==='hogging')z+=pose.flex*4.8*centreShape;
  if(state.mode==='sagging')z-=pose.flex*4.8*centreShape;
  if(state.mode==='whipping')z+=pose.flex*3.8*Math.cos(x/32*Math.PI);
  if(state.mode==='torsion') {
    const twist=pose.flex*.25*x/32;
    [y,z]=[y*Math.cos(twist)-z*Math.sin(twist),y*Math.sin(twist)+z*Math.cos(twist)];
  }
  return rotateAndTranslate([x,y,z],pose);
}
export function rotateAndTranslate(point,pose) {
  let [x,y,z]=point;
  const r=pose.roll*RAD,p=-pose.pitch*RAD,a=pose.yaw*RAD;
  [y,z]=[y*Math.cos(r)-z*Math.sin(r),y*Math.sin(r)+z*Math.cos(r)];
  [x,z]=[x*Math.cos(p)+z*Math.sin(p),-x*Math.sin(p)+z*Math.cos(p)];
  [x,y]=[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
  return [x+pose.surge,y+pose.sway,z+pose.heave];
}
export function project(point,camera,width,height) {
  const a=camera.azimuth*RAD,e=camera.elevation*RAD;
  const [x,y,z]=point.map((coordinate,index)=>coordinate-camera.focus[index]);
  const horizontal=-Math.sin(a)*x+Math.cos(a)*y;
  const vertical=-Math.cos(a)*Math.sin(e)*x-Math.sin(a)*Math.sin(e)*y+Math.cos(e)*z;
  const depth=Math.cos(a)*Math.cos(e)*x+Math.sin(a)*Math.cos(e)*y+Math.sin(e)*z;
  const scale=Math.min(width/92,height/52)*camera.zoom;
  return {x:width*.5+horizontal*scale,y:height*.53-vertical*scale,depth,scale};
}
export function cameraFor(state) {
  const base=VIEWS[state.view]||VIEWS.perspective;
  return {...base,azimuth:base.azimuth+state.azimuthOffset,elevation:clamp(base.elevation+state.elevationOffset,3,89),zoom:base.zoom*clamp(state.zoom,.7,1.5)};
}
export function waveZ(x,y,state,time=state.time) {
  if(!state.waves||state.waveHeight===0)return 0;
  const heading=state.waveHeading*RAD;
  // Heading denotes where waves come from relative to the initial bow.
  const distance=-Math.cos(heading)*x+Math.sin(heading)*y;
  return state.waveHeight/2*Math.sin(distance/46*TAU-time/state.period*TAU);
}
export function primaryValue(state,pose=samplePose(state)) {
  if(MOTION_IDS.includes(state.mode))return pose[state.mode];
  if(state.mode==='combined')return pose[MOTION_IDS.includes(state.activeComponent)?state.activeComponent:'roll'];
  if(state.mode==='slamming')return pose.heave;
  return pose.flex;
}
