import { hullWidth,hullDeck,hullBottom,deformPoint,rotateAndTranslate,samplePose,cameraFor,project,waveZ,clamp } from './motion-core.mjs';

const STATIONS=Array.from({length:25},(_,i)=>-32+i*64/24);
function ring(x) {
  const b=hullWidth(x),d=hullDeck(x),k=hullBottom(x);
  return [[x,0,k],[x,b*.7,k+.35],[x,b,-1.2+(k+3.8)*.4],[x,b,d],[x,-b,d],[x,-b,-1.2+(k+3.8)*.4],[x,-b*.7,k+.35]];
}
function average(points) { return points.reduce((sum,p)=>sum+p[2],0)/points.length; }

export class MotionRenderer {
  constructor(canvas) {this.canvas=canvas;this.ctx=canvas.getContext('2d');this.width=900;this.height=520;this.faces=this.buildShip();}
  resize() {
    const box=this.canvas.getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1);
    this.width=Math.max(280,box.width);this.height=Math.max(280,box.height);
    this.canvas.width=Math.round(this.width*ratio);this.canvas.height=Math.round(this.height*ratio);
    this.ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  buildShip() {
    const faces=[];
    for(let i=0;i<STATIONS.length-1;i++) {
      const a=ring(STATIONS[i]),b=ring(STATIONS[i+1]);
      for(let j=0;j<7;j++) {
        const next=(j+1)%7;
        faces.push({points:[a[j],b[j],b[next],a[next]],part:j===3?'deck':'hull',side:j,station:(STATIONS[i]+STATIONS[i+1])/2,colour:j===3?'#425a60':j===0||j===6?'#b66153':j===1||j===5?'#a8534b':'#265367'});
      }
    }
    faces.push({points:ring(-32),part:'hull',station:-32,side:7,colour:'#294d60'});
    const box=(x0,x1,y0,y1,z0,z1,colours,part='fitting')=>{
      const p=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
      for(const [index,vertices] of [[0,[0,1,5,4]],[1,[1,2,6,5]],[2,[2,3,7,6]],[3,[3,0,4,7]],[4,[4,5,6,7]]])faces.push({points:vertices.map(i=>p[i]),part,colour:colours[index]||colours[0],station:(x0+x1)/2});
    };
    // Three hatch covers, coamings, aft accommodation and bridge wings.
    for(const x of [-17,-3,11]){
      box(x-5.2,x+5.2,-4.3,4.3,2.85,3.35,['#72858b','#657b83','#516d79','#71888a','#9aa9a8'],'hatch');
      box(x-4.9,x+4.9,-4,4,3.35,3.55,['#284e5a','#305c63','#2f5a64','#2c5862','#3d7174'],'hatch');
    }
    box(-29,-22,-4.7,4.7,3.2,7.8,['#b9c9cd','#d9e5e5','#c7d6d6','#a2bdc7','#e7eeee']);
    box(-28.8,-22.3,-4.9,4.9,7.8,9.8,['#cadadb','#dbe9e8','#b5cdd1','#b9d0d6','#e7f1ef']);
    box(-27.4,-23,-5.8,5.8,9.4,10.1,['#698a96','#79a4ad','#668c9d','#6e9ba5','#d3e6e4']);
    box(-30.2,-28.5,-1.8,1.8,7.6,11.6,['#d7a264','#eac07b','#b58d58','#b48e59','#344d57']);
    return faces;
  }
  draw(state) {
    if(!this.ctx)return;
    this.state=state;this.pose=samplePose(state);this.camera=cameraFor(state);
    const ctx=this.ctx,w=this.width,h=this.height;
    ctx.clearRect(0,0,w,h);
    const background=ctx.createLinearGradient(0,0,w,h);background.addColorStop(0,'#102d40');background.addColorStop(.6,'#091f30');background.addColorStop(1,'#12333e');ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
    this.drawSea();
    if(state.axes)this.drawAxes();
    if(state.reference)this.drawReference();
    this.drawShip();
    this.drawDetails();
    if(['panting','racking'].includes(state.mode))this.drawSectionInset();
    if(['hogging','sagging'].includes(state.mode))this.drawBendingGuide();
    if(this.pose.impact>.02)this.drawImpact();
    this.drawMotionGuide();
    return this.pose;
  }
  p(point,moving=true){return project(moving?deformPoint(point,this.state,this.pose):point,this.camera,this.width,this.height);}
  path(points,{fill=null,stroke=null,width=1,alpha=1,closed=true,dash=[]}={}) {
    if(!points.length)return;
    const c=this.ctx;c.save();c.globalAlpha=alpha;c.beginPath();c.moveTo(points[0].x,points[0].y);for(const point of points.slice(1))c.lineTo(point.x,point.y);if(closed)c.closePath();
    c.setLineDash(dash);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}c.restore();
  }
  line(points,colour='#76a2b4',width=1,alpha=1,dash=[]){this.path(points,{stroke:colour,width,alpha,closed:false,dash});}
  label(text,x,y,colour='#c0dce5',size=10,align='center') {
    const c=this.ctx;c.save();c.font=`600 ${size}px system-ui, sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=colour;c.shadowColor='#061b28';c.shadowBlur=5;c.fillText(text,x,y);c.restore();
  }
  arrow(a,b,colour,width=1.7,alpha=1) {
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<1)return;
    this.line([a,b],colour,width,alpha);const angle=Math.atan2(dy,dx),size=6;
    this.path([b,{x:b.x-size*Math.cos(angle-.45),y:b.y-size*Math.sin(angle-.45)},{x:b.x-size*Math.cos(angle+.45),y:b.y-size*Math.sin(angle+.45)}],{fill:colour,alpha});
  }
  drawSea() {
    const s=this.state;
    this.path([[-57,-31,0],[57,-31,0],[57,31,0],[-57,31,0]].map(p=>this.p(p,false)),{fill:'#16465a',alpha:.18,stroke:'#4a8797',width:1});
    for(let y=-30;y<=30;y+=3){const points=[];for(let x=-56;x<=56;x+=3)points.push(this.p([x,y,waveZ(x,y,s)],false));this.line(points,'#4b9cac',.75,.24);}
    for(let x=-54;x<=54;x+=6){const points=[];for(let y=-30;y<=30;y+=3)points.push(this.p([x,y,waveZ(x,y,s)],false));this.line(points,'#4d96a8',.6,.12);}
    if(s.waves&&s.waveHeight>0){
      const heading=s.waveHeading*Math.PI/180,from=[Math.cos(heading)*37,-Math.sin(heading)*24,0],to=[from[0]-Math.cos(heading)*10,from[1]+Math.sin(heading)*10,0];
      const a=this.p(from,false),b=this.p(to,false);this.arrow(a,b,'#8cc9d9',2,.7);this.label('WAVE TRAVEL',a.x,a.y-15,'#8bb2c2',8);
    }
  }
  drawAxes() {
    const origin=this.p([0,0,0],false);
    const axes=[{point:[43,0,0],colour:'#efc16e',label:'LONGITUDINAL',id:'long'},{point:[0,23,0],colour:'#55d9c4',label:'TRANSVERSE',id:'cross'},{point:[0,0,18],colour:'#8fb7ff',label:'VERTICAL',id:'vertical'}];
    for(const axis of axes){const end=this.p(axis.point,false);this.arrow(origin,end,axis.colour,1.2,.6);if(end.x>30&&end.x<this.width-30&&end.y>18&&end.y<this.height-18)this.label(axis.label,end.x,end.y-11,axis.colour,8);}
  }
  drawReference() {
    const c=this.ctx;c.save();
    for(const x of [-30,-16,0,16,30])this.path(ring(x).map(p=>this.p(p,false)),{stroke:'#a2bdc9',alpha:.34,width:1,dash:[4,4]});
    for(const index of [0,3,4])this.line(STATIONS.map(x=>this.p(ring(x)[index],false)),'#b0c9d3',1,.6,[5,5]);
    c.restore();
  }
  drawShip() {
    const state=this.state;
    const faces=this.faces.filter(face=>{
      if(!state.cutaway)return true;
      if(face.part==='hull'&&face.side>=4&&face.side<=5)return false;
      if(state.mode==='panting'&&face.part==='deck'&&face.station>13)return false;
      if(state.mode==='racking'&&face.station>8)return false;
      return true;
    }).map(face=>{
      const world=face.points.map(p=>deformPoint(p,state,this.pose));
      const points=world.map(p=>project(p,this.camera,this.width,this.height));
      return {...face,world,points,depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length};
    }).sort((a,b)=>a.depth-b.depth);
    for(const face of faces){
      let colour=face.colour;
      if(state.mode==='panting'&&face.part==='hull'&&face.station>13)colour='#2a9b94';
      const submerged=average(face.world)<-.25;
      this.path(face.points,{fill:colour,stroke:face.part==='hull'?'#8fb6c7':'#bfd6d8',width:.55,alpha:submerged?.5:.97});
    }
    if(state.cutaway){
      const cuts=state.mode==='panting'?[14,18,22,26,29]:[-22,-15,-8,0,8];
      for(const x of cuts)this.path(ring(x).map(p=>this.p(p)),{stroke:'#5fdac1',width:1.8,alpha:.8});
      this.line(STATIONS.map(x=>this.p([x,0,hullBottom(x)+.6])),'#a2c2c9',1.4,.8);
      this.line(STATIONS.map(x=>this.p([x,-hullWidth(x)*.82,.3])),'#75b5ad',1,.8);
      if(state.mode==='panting')for(const x of [18,24,28])this.line([[x,-hullWidth(x)*.75,.6],[x,hullWidth(x)*.75,.6]].map(p=>this.p(p)),'#f1c376',1.7,.85);
    }
  }
  drawDetails() {
    const s=this.state;
    // Deck rails and hatch-cover divisions are attached to the moving / flexing hull.
    for(const side of [-1,1]){
      for(const height of [.4,1])this.line(STATIONS.map(x=>this.p([x,hullWidth(x)*side,hullDeck(x)+height])),'#a7c7cb',.8,.7);
      for(const x of [-29,-24,-18,-12,-6,0,6,12,18,24,28])this.line([[x,hullWidth(x)*side,hullDeck(x)],[x,hullWidth(x)*side,hullDeck(x)+1]].map(p=>this.p(p)),'#9bbdc5',.7,.7);
    }
    for(const x of [-17,-3,11])for(let offset=-3;offset<=3;offset+=2)this.line([[x+offset,-4,3.57],[x+offset,4,3.57]].map(p=>this.p(p)),'#75a8a8',.7,.8);
    for(const y of [-4,-2,0,2,4])this.line([[-22.28,y,8.5],[-22.28,y+.9,8.5]].map(p=>this.p(p)),'#103a52',3,.9);
    this.line([[-25,0,10.2],[-25,0,14.5]].map(p=>this.p(p)),'#d2dfe0',1.5);
    this.line([[-25,-3,13],[-25,3,13]].map(p=>this.p(p)),'#d2dfe0',1.3);
    for(const x of [-10,4]){
      this.line([[x,0,3.6],[x,0,9.8],[x+7,0,7],[x,0,4.8]].map(p=>this.p(p)),'#d0bb8d',2,.9);
      this.line([[x,0,9.8],[x+7,0,7],[x+7,0,3.8]].map(p=>this.p(p)),'#a7babd',.8,.7);
    }
    if(['hogging','sagging'].includes(s.mode)){
      const deck=s.mode==='hogging'?'#f6bf76':'#91b6ff',bottom=s.mode==='hogging'?'#91b6ff':'#f6bf76';
      this.line(STATIONS.map(x=>this.p([x,-hullWidth(x),hullDeck(x)])),deck,3,.95);
      this.line(STATIONS.map(x=>this.p([x,0,hullBottom(x)])),bottom,2.5,.9);
    }
    const bow=this.p([33,0,5.4]),stern=this.p([-34,0,4.8]);
    if(bow.x>18&&bow.x<this.width-18&&bow.y>20&&bow.y<this.height-20)this.label('BOW',bow.x,bow.y,'#a6e8d5',9);
    if(stern.x>18&&stern.x<this.width-18&&stern.y>20&&stern.y<this.height-20)this.label('STERN',stern.x,stern.y,'#b4cbd7',9);
  }
  drawSectionInset() {
    const c=this.ctx,w=this.width<500?150:195,h=140,left=16,top=17;
    c.save();c.fillStyle='#071d2eea';c.strokeStyle='#416373';c.lineWidth=1;c.beginPath();c.roundRect(left,top,w,h,10);c.fill();c.stroke();
    this.label(this.state.mode==='panting'?'BOW FRAME · FLEX MAGNIFIED':'SECTION · SHAPE CHANGE',left+12,top+18,'#a9c8d5',8,'left');
    const x=this.state.mode==='panting'?24:0,scale=Math.min(7,w/23),centerX=left+w/2,centerY=top+81;
    const flat=p=>({x:centerX+p[1]*scale,y:centerY-p[2]*scale});
    this.path(ring(x).map(flat),{stroke:'#87a7ba',width:1.1,alpha:.7,dash:[4,3]});
    this.path(ring(x).map(p=>flat(deformPoint(p,this.state,this.pose))),{stroke:'#55e2c2',fill:'#2fbd991b',width:2});
    const label=this.state.mode==='panting'?(this.pose.flex>=0?'SHELL FLEXED OUT':'SHELL FLEXED IN'):(this.pose.flex>=0?'DECK OFFSET TO PORT':'DECK OFFSET TO STARBOARD');
    this.label(label,left+w/2,top+h-13,'#71d9c4',8);c.restore();
  }
  drawBendingGuide() {
    const base=this.p([0,0,3],false),moved=this.p([0,0,3]);this.arrow(base,moved,'#eec67d',2,.9);
    const text=this.state.mode==='hogging'?'MIDSHIPS UP · DECK IN TENSION':'MIDSHIPS DOWN · DECK IN COMPRESSION';
    this.label(text,this.width/2,24,'#e7ce9b',this.width<500?8:10);
  }
  drawImpact() {
    const strength=this.pose.impact,c=this.ctx,world=rotateAndTranslate([27,0,hullBottom(27)],this.pose),point=project([world[0],world[1],waveZ(world[0],world[1],this.state)],this.camera,this.width,this.height);
    c.save();c.strokeStyle=`rgba(255,207,130,${Math.min(1,strength*1.6)})`;c.lineWidth=2;for(const radius of [10,20,32]){c.beginPath();c.ellipse(point.x,point.y,radius*(1+strength),radius*.34,0,0,Math.PI*2);c.stroke();}c.restore();
    for(const offset of [-2,0,2])this.arrow({x:point.x+offset*8,y:point.y+40},{x:point.x+offset*5,y:point.y+5},'#f5c078',1.7,strength);
    this.label(this.state.mode==='whipping'?'ILLUSTRATED IMPULSE':'FORE-BOTTOM IMPACT',this.width/2,this.height-100,'#f4c784',10);
  }
  drawMotionGuide() {
    const mode=this.state.mode;
    if(['roll','pitch','yaw'].includes(mode)) {
      const points=[],axis=mode==='roll'?'x':mode==='pitch'?'y':'z';
      for(let i=0;i<=38;i++){
        const t=i/38*Math.PI*1.65-.3,r=mode==='yaw'?15:9;
        const p=axis==='x'?[0,Math.cos(t)*r,Math.sin(t)*r]:axis==='y'?[Math.cos(t)*r,0,Math.sin(t)*r]:[Math.cos(t)*r,Math.sin(t)*r,0];points.push(this.p(p,false));
      }
      this.line(points,'#e7be78',1.3,.65,[4,3]);this.arrow(points.at(-2),points.at(-1),'#e7be78',1.3,.8);
    }
    if(['heave','sway','surge'].includes(mode)) {
      const v=mode==='heave'?[0,0,10]:mode==='sway'?[0,15,0]:[22,0,0];
      const a=this.p(v.map(x=>-x),false),b=this.p(v,false);this.arrow(a,b,'#e7be78',1.5,.8);this.arrow(b,a,'#e7be78',1.5,.8);
    }
  }
}
