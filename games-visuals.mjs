import { escapeHTML as esc } from './games-core.mjs';

const paths = {
  scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
  layers:'<path d="m12 3 10 6-10 6L2 9Zm-10 12 10 6 10-6M2 12l10 6 10-6"/>',
  search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M8 10h4m-2-2v4"/>',
  wave:'<path d="M2 7q5-7 10 0t10 0M2 16q5-7 10 0t10 0"/>',
  cargo:'<path d="m3 7 9-5 9 5v11l-9 4-9-4Zm0 0 9 5 9-5M12 12v10M7 5l10 5"/>',
  balance:'<path d="M12 3v18M7 21h10M3 7h18M6 7 2 15h8Zm12 0-4 8h8Z"/>',
  ship:'<path d="M4 12V6h16v6M9 6V2h6v4M2 13l10-4 10 4-4 7H6Zm10-4v11M2 22q3-3 6 0t6 0t6 0"/>',
  shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  home:'<path d="m3 10 9-8 9 8v11H3Zm6 11v-8h6v8"/>'
};
export function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.ship}</svg>`; }
let diagramId=0;
export function svg(content, label, extra='') {
  const grid=`drawing-grid-${++diagramId}`;
  return `<svg viewBox="0 0 600 370" role="img" aria-label="${esc(label)}" ${extra}><defs><pattern id="${grid}" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#8cb1c6" stroke-opacity=".08"/></pattern></defs><rect width="600" height="370" fill="#0b2334"/><rect width="600" height="370" fill="url(#${grid})"/>${content}</svg>`;
}

export const ZONES = [
  {id:'deck',letter:'A',x:180,y:73,position:'upper left deck edge',shape:'<path d="M130 88h112m116 0h112" fill="none" stroke-width="10"/>'},
  {id:'shell',letter:'B',x:118,y:215,position:'left outer hull side',shape:'<path d="M130 93v160q0 78 80 78h180q80 0 80-78V93" fill="none" stroke-width="9"/>'},
  {id:'topside',letter:'C',x:155,y:119,position:'upper triangular wing space',shape:'<path d="M136 96h94l-94 76Zm328 0h-94l94 76Z"/>'},
  {id:'hopper',letter:'D',x:169,y:278,position:'lower sloping wing space',shape:'<path d="M136 243 217 288v36h-19q-62 0-62-65Zm328 0-81 45v36h19q62 0 62-65Z"/>'},
  {id:'tanktop',letter:'E',x:264,y:274,position:'horizontal lower hold surface',shape:'<path d="M216 292h168" fill="none" stroke-width="10"/>'},
  {id:'double',letter:'F',x:247,y:317,position:'space under the hold surface',shape:'<path d="M222 300h156v24H222Z"/>'},
  {id:'girder',letter:'G',x:305,y:345,position:'centreline member under the hold',shape:'<path d="M300 300v27" fill="none" stroke-width="8"/>'},
  {id:'hatch',letter:'H',x:250,y:51,position:'raised edge of the cargo opening',shape:'<path d="M240 88V60h12m108 28V60h-12" fill="none" stroke-width="9"/>'},
  {id:'bilge',letter:'I',x:104,y:310,position:'outside the turn of the bilge',shape:'<path d="m132 284-28 18 5 7 29-18m330-7 28 18-5 7-29-18"/>'},
  {id:'frame',letter:'J',x:159,y:209,position:'internal vertical side support',shape:'<path d="M145 178v66l18 12M455 178v66l-18 12" fill="none" stroke-width="8"/>'}
];

export function crossSection({highlight='',interactive=false,build=false,placed=[],ids=ZONES.map(z=>z.id),letters=true}={}) {
  const elements = ZONES.filter(zone=>ids.includes(zone.id)).map(zone => {
    const active=zone.id===highlight, done=placed.includes(zone.id), empty=build&&!done;
    const attrs = interactive ? `role="button" tabindex="0" data-zone="${zone.id}" aria-label="Zone ${zone.letter}: ${zone.position}"` : '';
    return `<g class="structure-zone ${active?'lit':''} ${empty?'unbuilt':''} ${done?'placed':''}" ${attrs} style="--part-fill:${active?'#3de1c5':done?'#32c8b2':'#1d465b'};--part-stroke:${active?'#b4fff0':done?'#69f0d6':'#6e9db2'}">${zone.shape}${letters?`<circle class="zone-marker" cx="${zone.x}" cy="${zone.y}" r="12"/><text class="zone-letter" x="${zone.x}" y="${zone.y+4}" text-anchor="middle">${zone.letter}</text>`:''}</g>`;
  }).join('');
  return svg(`<path d="M300 32v306" stroke="#8eb0c4" stroke-dasharray="4 5" opacity=".25"/><text x="300" y="187" text-anchor="middle" fill="#789bab" font-size="13" letter-spacing="3">CARGO HOLD</text>${elements}<text x="300" y="363" fill="#95afbe" font-size="10" text-anchor="middle">BULK CARRIER · TRANSVERSE SECTION · SCHEMATIC</text>`,interactive?'Interactive bulk carrier cross-section with lettered zones':'Bulk carrier cross-section with one highlighted part',interactive?'class="section-svg interactive-svg"':'class="section-svg"');
}

export function bending(shape, reveal=false) {
  const delta=shape==='hogging'?-58:58;
  const hull=`M70 165Q300 ${165+delta*2} 530 165L500 220Q300 ${220+delta*2} 100 220Z`;
  return svg(`<path d="M40 165h520" stroke="#91aebd" stroke-dasharray="7 7" opacity=".65"/><text x="45" y="148" fill="#99b6c4" font-size="12">END REFERENCE LINE</text><path class="bending-hull" d="${hull}" fill="#24566c" stroke="#5ee0d1" stroke-width="4"/><path d="M300 165v${delta}" stroke="#f2c873" stroke-width="3"/><circle cx="300" cy="${165+delta}" r="7" fill="#f2c873"/><text x="300" y="${shape==='hogging'?78:315}" text-anchor="middle" fill="#e8f5fb" font-size="17">MIDSHIPS ${shape==='hogging'?'HIGHER':'LOWER'} THAN THE ENDS</text><text x="300" y="348" text-anchor="middle" fill="#8caebf" font-size="11">${reveal?shape.toUpperCase()+' · ':''}DEFLECTION EXAGGERATED FOR LEARNING</text>`,`${shape==='hogging'?'Midship higher':'Midship lower'} than the ends; exaggerated longitudinal hull bending`,'class="bending-svg"');
}

export function stabilityDiagram(kind, reveal=false) {
  const up=kind==='raise', down=kind==='lower', side=['starboard','port'].includes(kind), liquid=kind==='free';
  const from=up?253:down?122:side?(kind==='port'?410:300):300;
  const to=up?122:down?253:side?(kind==='port'?300:410):300;
  const movement=side?`M${from} 202H${to}`:`M300 ${from}V${to}`;
  const cargo=(side?`<rect x="${from-17}" y="185" width="34" height="34"/>`:`<rect x="283" y="${from-17}" width="34" height="34"/>`);
  return svg(`<path d="M115 150h370l-36 150H151Z" fill="#153d52" stroke="#7da9bc" stroke-width="3"/><path d="M50 230h500" stroke="#2faabd" stroke-width="2"/><text x="67" y="219" fill="#8ab9ca" font-size="12">WATERLINE</text><path d="M300 63v250" stroke="#7da9bc" stroke-dasharray="5 5"/><circle cx="300" cy="118" r="5" fill="#a9c5eb"/><text x="315" y="122" fill="#a9c5eb">M</text><circle cx="300" cy="228" r="6" fill="#f2c873"/><text x="315" y="232" fill="#f2c873">G (initial)</text>${kind==='gm'?'<text x="300" y="337" fill="#c7dce6" font-size="15" text-anchor="middle">GM corrected = KM − KG − FSC</text>':liquid?'<path d="M175 260h250v27H175Z" fill="#2c8db1"/><path class="liquid-surface" d="M175 260q60-20 125 0t125 0" fill="none" stroke="#70e8ed" stroke-width="4"/><text x="300" y="335" fill="#c7dce6" text-anchor="middle" font-size="14">SLACK TANK · LIQUID CAN MOVE TRANSVERSELY</text>':`<g class="moving-weight" fill="#43dfc0" stroke="#ccfff1" stroke-width="2" style="--move-x:${side?to-from:0}px;--move-y:${side?0:to-from}px">${cargo}</g><path d="${movement}" stroke="#f2c873" stroke-width="2" stroke-dasharray="5 4"/><text x="300" y="337" fill="#c7dce6" text-anchor="middle" font-size="14">${side?'PORT ← CENTRELINE → STARBOARD':'EXISTING SECURED WEIGHT MOVED VERTICALLY'}</text>`}`,`Schematic illustrating ${kind==='free'?'free liquid movement':kind==='gm'?'initial metacentric height':'a cargo weight movement'}; positions not to scale`);
}

export function defectDiagram(kind) {
  const centers=[100,300,500];
  const panels=centers.map((x,i)=>{
    const region=['A','B','C'][i];
    const defect=(kind==='crack'&&region==='B')?`<path d="m${x-5} 205 8 15-13 8 9 12-9 15" fill="none" stroke="#ffcf97" stroke-width="4"/>`:
      (kind==='coating'&&region==='C')?`<path d="m${x-31} 163 18-10 16 13 21-3 12 29-19 17-23-6-20 7-11-25Z" fill="#bb7440" stroke="#edb57e" stroke-width="3"/>`:
      (kind==='pitting'&&region==='A')?Array.from({length:12},(_,j)=>`<circle cx="${x-29+(j%4)*19}" cy="${168+Math.floor(j/4)*22}" r="${4+j%3}" fill="#142f3f" stroke="#d39960" stroke-width="2"/>`).join(''):
      (kind==='dent'&&region==='C')?`<path d="M${x-54} 220q45-90 91-6" fill="none" stroke="#e9bd83" stroke-width="5"/><path d="m${x-46} 208 26-28 36 4 29 30" fill="#20485c" stroke="#8ab6c8" stroke-width="2"/>`:'';
    return `<g><rect x="${x-77}" y="85" width="154" height="200" rx="7" fill="#21495c" stroke="#668da2" stroke-width="2"/><path d="M${x-65} 130h130m-130 110h130M${x} 95v175" stroke="#8eb4c3" opacity=".3"/>${kind==='crack'?`<path d="m${x-38} 210 38-78v78Z" fill="#416d7e" stroke="#9ebac8" stroke-width="2"/>`:''}${defect}<text x="${x}" y="316" text-anchor="middle" fill="#e8f5fa" font-size="18" font-weight="700">REGION ${region}</text></g>`;
  }).join('');
  return svg(`<text x="300" y="43" text-anchor="middle" fill="#9eb8c8" font-size="12" letter-spacing="2">TRAINING INSPECTION · ILLUSTRATED INDICATIONS</text>${panels}`,`Three lettered steel inspection panels showing ${kind} among intact details`);
}

export const BOUNDARY_POINTS = [
  {id:'door-open',letter:'A',x:200,y:125,label:'upper door opening'},
  {id:'pipe-gap',letter:'B',x:390,y:245,label:'lower pipe penetration'},
  {id:'plate-crack',letter:'C',x:200,y:245,label:'lower bulkhead plate'},
  {id:'door-closed',letter:'D',x:390,y:125,label:'upper closed door'},
  {id:'sealed-pipe',letter:'E',x:295,y:185,label:'middle sealed pipe'},
  {id:'intact',letter:'F',x:495,y:185,label:'right intact boundary'}
];
export function boundaryDiagram(targets,found=[],revealed=false) {
  const points=BOUNDARY_POINTS.map(point=>{
    const broken=targets.includes(point.id),done=found.includes(point.id);
    let detail='';
    if(point.id.includes('door')) detail=broken?'<path d="M-8-27v54M-8-27l33 16v54L-8 27" fill="#133847" stroke="#e8ad79" stroke-width="3"/>':'<rect x="-12" y="-27" width="24" height="54" rx="3" fill="#35776f" stroke="#80d7c3" stroke-width="3"/><circle cx="4" cy="0" r="4" fill="#c6f4e7"/>';
    else if(point.id.includes('pipe')) detail=`<circle r="19" fill="#0a2232" stroke="${broken?'#e0ac78':'#6acbb9'}" stroke-width="${broken?2:8}"/><circle r="10" fill="#648fa2" stroke="#c1d9e3" stroke-width="2"/>`;
    else if(point.id==='plate-crack'&&broken) detail='<path d="m-5-25 12 12-14 13 14 11-11 16" fill="none" stroke="#f5b07e" stroke-width="4"/>';
    else detail='<rect x="-8" y="-27" width="16" height="54" fill="#39697a" stroke="#83afbe" stroke-width="2"/>';
    return `<g class="boundary-point ${done?'found':''}" role="button" tabindex="0" data-boundary="${point.id}" aria-label="Boundary point ${point.letter}: ${point.label}" transform="translate(${point.x} ${point.y})"><rect x="-32" y="-36" width="64" height="72" rx="8" fill="${done?'#32b79d33':'#0b263c'}" stroke="${done?'#4ce6bd':revealed&&broken?'#edba7c':'#426478'}" stroke-width="2"/>${detail}<circle cx="27" cy="-32" r="11" fill="#e4f6f7"/><text x="27" y="-28" text-anchor="middle" fill="#0b2e3b" font-size="12" font-weight="800">${point.letter}</text></g>`;
  }).join('');
  return svg(`<path d="M70 65h460v240H70Z" fill="#123649" stroke="#91b1bf" stroke-width="5"/><path d="M200 65v240M390 65v240M70 185h460M495 65v240" stroke="#7099ac" stroke-width="9"/><path d="M73 68h123v114H73Z" fill="#288eaf" opacity=".22"/><text x="133" y="98" text-anchor="middle" fill="#7dcfe1" font-size="11">WATER HERE</text>${points}<text x="300" y="343" text-anchor="middle" fill="#94b3c5" font-size="11">TOP VIEW · TRACE EACH BULKHEAD AND ITS OPENINGS</text>`,'Compartment plan with six lettered boundary details; find openings or damage','class="interactive-svg"');
}

export function roroDiagram() {
  return svg('<path d="M55 240h490l-34 55H90Z" fill="#2d647b" stroke="#87bcd0" stroke-width="3"/><path d="M100 103h362v136H100Z" fill="#d0e1e7"/><path d="M115 120h330m-330 22h330m-330 22h330m-330 22h330m-330 22h330" stroke="#4a788d" stroke-width="3"/><path d="M465 220h63l40 55h-25l-42-35h-36Z" fill="#4ee0c1" stroke="#b8f9eb" stroke-width="3"/><path d="M165 89h50v14m-15-16V67" stroke="#afd1e1" stroke-width="6"/><text x="300" y="49" fill="#a6c0ce" font-size="12" text-anchor="middle">SCHEMATIC VESSEL PROFILE · VEHICLE DECKS & STERN RAMP</text><text x="300" y="340" fill="#94adbf" font-size="12" text-anchor="middle">DIAGRAM CHALLENGE</text>','Schematic ship with enclosed vehicle decks and a stern loading ramp');
}

export function thumbnail(kind) {
  if(['section','build'].includes(kind)) return crossSection({highlight:kind==='build'?'tanktop':'topside',letters:false});
  if(kind==='bending') return bending('hogging');
  if(kind==='stability') return stabilityDiagram('raise');
  if(kind==='boundary') return boundaryDiagram(['door-open','pipe-gap']);
  if(kind==='defect') return defectDiagram('crack');
  if(kind==='match') return svg('<path d="M185 110C350 110 230 260 410 260M185 260C330 260 265 110 410 110" fill="none" stroke="#42d9bd" stroke-width="4" stroke-dasharray="8 7"/><rect x="65" y="80" width="165" height="65" rx="12" fill="#234b60" stroke="#6ea3bb"/><rect x="65" y="230" width="165" height="65" rx="12" fill="#234b60" stroke="#6ea3bb"/><rect x="370" y="80" width="165" height="65" rx="12" fill="#1d504d" stroke="#63d8bf"/><rect x="370" y="230" width="165" height="65" rx="12" fill="#1d504d" stroke="#63d8bf"/><text x="148" y="120" text-anchor="middle" fill="#d8eff6" font-size="19">PART</text><text x="452" y="270" text-anchor="middle" fill="#b4f6e5" font-size="19">FUNCTION</text>','Connect parts to their functions');
  return svg('<path d="m90 75 210-40 210 40v200l-210 65-210-65Z" fill="#193f53" stroke="#4c95ae" stroke-width="3"/><path d="M160 125h280M160 195h280M230 70v230M370 70v230" stroke="#77b8cc" stroke-width="2"/><g fill="#49d2b7" stroke="#b6fae7" stroke-width="2"><rect x="175" y="90" width="40" height="40" rx="5"/><rect x="385" y="215" width="40" height="40" rx="5"/><rect x="280" y="160" width="40" height="40" rx="5"/></g>','Cargo balance puzzle');
}
