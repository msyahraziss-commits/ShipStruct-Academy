import { PROGRESS_KEY, shuffle, matchesAnswer, scorePercent, readProgress, recordResult, markFirstAttempt, loadingBalance, partialMoments, escapeHTML as esc } from './games-core.mjs';
import { GAMES, PARTS, PHOTOS, SHIP_TYPES, STABILITY, BENDING, DEFECTS, LOAD_LEVELS, BOUNDARIES } from './games-data.mjs';
import { icon, thumbnail, crossSection, ZONES, bending, stabilityDiagram, defectDiagram, boundaryDiagram, BOUNDARY_POINTS, roroDiagram } from './games-visuals.mjs';

const app=document.getElementById('app');
let progress=readProgress(null),storageOK=true,mode='practice',category='All games',recall=false,session=null,clockInterval;
try { progress=readProgress(localStorage.getItem(PROGRESS_KEY)); } catch { storageOK=false; }
const lessonLink=id=>`index.html#lesson/${id}`;
const announce=text=>{document.getElementById('announcer').textContent=text;};
const focusMain=()=>document.getElementById('main').focus({preventScroll:true});
const formatTime=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
const modes=()=>`<label class="mode-control">Play mode <select id="play-mode"><option value="practice" ${mode==='practice'?'selected':''}>Practice · no time limit</option><option value="challenge" ${mode==='challenge'?'selected':''}>Challenge · 2 minutes</option></select></label>`;

function photoCredit(key,includeTitle=true) {
  const p=PHOTOS[key];
  return `<div class="photo-credit">${includeTitle?esc(p.title)+' · ':''}<a href="${p.source}" target="_blank" rel="noopener noreferrer">${esc(p.author)}</a> · <a href="${p.licenseURL}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a>. Original photo; display scaled. Annotations are training overlays.</div>`;
}
function photo(key,{marker='',regions=false,revealed=false}={}) {
  const p=PHOTOS[key];
  return `<div class="photo-frame"><img src="${p.src}" alt="${regions?'Ship bow with three lettered inspection regions':marker?'Dry-docked ship stern with a highlighted component': 'Ship photograph for identification'}" ${marker||regions?'':'loading="eager"'}>${marker?`<span class="photo-marker" style="left:${marker==='rudder'?18:48}%;top:25%;width:${marker==='rudder'?24:19}%;height:${marker==='rudder'?42:30}%"></span>`:''}${regions?['A','B','C'].map((region,i)=>`<button class="photo-region ${revealed&&region==='A'?'correct':''}" data-region="${region}" aria-label="Select region ${region}" ${revealed?'disabled':''} style="left:${[42,8,78][i]}%;top:${[35,17,49][i]}%;width:${[20,22,18][i]}%;height:${[48,28,32][i]}%"><span>${region}</span></button>`).join(''):''}</div>${photoCredit(key,revealed)}`;
}

function renderHub() {
  const stats=Object.values(progress.games).flatMap(entry=>Object.values(entry));
  const tried=Object.keys(progress.games).length,runs=stats.reduce((sum,item)=>sum+item.runs,0);
  const mastered=Object.values(progress.games).filter(entry=>Object.values(entry).some(stat=>stat.best===100)).length;
  app.innerHTML=`<section class="hub-hero"><div><span class="eyebrow">THE PRACTICE DECK</span><h1>Play a little.<br><span>Know the ship better.</span></h1><p>Ten short games to sharpen your eye for ship structure. Identify, connect, inspect and predict — one discovery at a time.</p><div class="hero-badges"><span class="pill">${icon('layers')}10 interactive games</span><span class="pill">Real photos + diagrams</span><span class="pill mint">Made for cadets</span></div></div><div class="hero-drawing" aria-hidden="true">${crossSection({highlight:'topside',letters:false})}</div></section>
    <div class="hub-stats"><div class="stat"><span class="stat-icon">${icon('target')}</span><div><strong>${tried}<small> / 10</small></strong><p>Games explored</p></div></div><div class="stat"><span class="stat-icon">${icon('wave')}</span><div><strong>${runs}</strong><p>Games completed</p></div></div><div class="stat"><span class="stat-icon">${icon('check')}</span><div><strong>${mastered}</strong><p>Games with a perfect score</p></div></div></div>
    <div class="section-head"><div><h2>Choose your next challenge</h2><p>Start anywhere. Every answer comes with a reason.</p></div>${modes()}</div><div class="filters" aria-label="Filter games">${['All games','Identify','Connect','Inspect','Predict'].map(item=>`<button class="filter ${category===item?'active':''}" data-filter="${item}" aria-pressed="${category===item}">${item}</button>`).join('')}</div>
    <div class="games-grid">${GAMES.filter(game=>category==='All games'||game.category===category).map(game=>{
      const best=progress.games[game.id]?.[mode]?.best;
      return `<article class="game-card" data-category="${game.category}"><div class="card-image" aria-hidden="true">${game.visual==='photo'?'<img src="game-lng-carrier.jpg" alt="" loading="lazy">':thumbnail(game.visual)}<span class="card-number">${String(GAMES.indexOf(game)+1).padStart(2,'0')} / 10</span></div><div class="card-content"><span class="category-label">${game.category} · MODULE ${String(game.module).padStart(2,'0')}</span><h3>${game.title}</h3><p>${game.description}</p><div class="card-meta"><span>${game.length}</span><span class="card-best">${best===undefined?game.skills:`Best: ${best}% · ${mode}`}</span></div><a class="play-btn" href="#${game.id}" aria-label="Play ${game.title}">Play game ${icon('arrow')}</a></div></article>`;
    }).join('')}</div>
    <div class="hub-bottom"><div class="info-card"><span class="eyebrow">LEARN AT YOUR PACE</span><h3>Practice first. Challenge yourself next.</h3><p>Practice has hints and no time limit. Challenge gives you two minutes with no hints. Scores count first attempts; retries help you finish and learn.</p><a class="text-link" href="index.html#academy">Review your course modules →</a></div><div class="info-card"><span class="eyebrow">YOUR OWN PRACTICE RECORD</span><h3>Small steps, visible progress.</h3><p>${storageOK?'Best scores and completed rounds save in this browser.':'This browser cannot save scores. You can still play every game.'} These practice scores are separate from your Classroom examinations.</p><a class="text-link" href="notes.html">Open your lecturer’s course notes →</a></div></div>`;
}

function makeNameItems() {
  const internal=shuffle(PARTS).slice(0,6).map(part=>({id:part.id,prompt:'Name the highlighted structural part.',answer:part.name,aliases:part.aliases,options:shuffle([part.name,...shuffle(PARTS.filter(p=>p.id!==part.id)).slice(0,3).map(p=>p.name)]),explanation:part.function,hint:part.hint,lesson:part.lesson,part:part.id}));
  const stern=[{id:'propeller',name:'Propeller',aliases:['propeller','screw propeller','screw'],function:'Converts shaft power into thrust to propel the ship.',hint:'Rotating blades create thrust.'},{id:'rudder',name:'Rudder',aliases:['rudder','rudder blade'],function:'Produces a steering force when water flows past its deflected blade.',hint:'This steering surface sits aft of the propeller.'}].map(part=>({id:part.id,prompt:'Dry-dock challenge: name the highlighted component.',answer:part.name,aliases:part.aliases,options:shuffle([part.name,'Bilge keel','Hatch coaming',part.id==='rudder'?'Propeller':'Rudder']),explanation:part.function,hint:part.hint,lesson:'shell-bulkheads',photo:'stern',marker:part.id}));
  return shuffle([...internal,...stern]);
}
function makeChoiceItems(id) {
  if(id==='name-part')return makeNameItems();
  if(id==='ship-type')return shuffle(SHIP_TYPES).map((item,index)=>({...item,id:`ship${index}`,prompt:item.prompt||'Read the deck arrangement. What type of ship is this?',options:shuffle(item.options),explanation:item.clue,hint:'Look at the cargo or passenger spaces and the deck equipment.',lesson:'tanker-double-hull'}));
  const source=id==='bending'?BENDING:STABILITY;
  return shuffle(source).map(item=>({...item,answer:item.options[item.answer],options:shuffle(item.options),hint:item.hint||'Compare the middle of the hull with the line joining its ends.',lesson:id==='bending'?'hull-bending':item.id==='free'?'free-surface':'stability-centres'}));
}
function startGame(id) {
  clearInterval(clockInterval);
  const game=GAMES.find(game=>game.id===id);if(!game)return;
  session={game,mode,index:0,earned:0,attempts:{},reviews:[],started:Date.now(),deadline:Date.now()+120000,done:false,selected:null,feedback:'',hint:false,answer:null};
  if(['name-part','ship-type','bending','stability'].includes(id)){session.items=makeChoiceItems(id);session.possible=session.items.length;}
  if(id==='find-part'){session.items=shuffle(PARTS).slice(0,6);session.possible=6;}
  if(id==='match'){session.items=shuffle(PARTS).slice(0,5);session.functions=shuffle(session.items);session.matched=[];session.possible=5;}
  if(id==='build'){session.items=shuffle(PARTS.filter(part=>!['bilge','frame'].includes(part.id)));session.placed=[];session.possible=8;}
  if(id==='defect'){session.items=shuffle(DEFECTS);session.possible=5;}
  if(id==='loading'){session.items=LOAD_LEVELS.map(level=>({...level,weights:shuffle(level.weights)}));session.possible=3;session.placements=Array(6).fill(null);}
  if(id==='watertight'){session.items=shuffle(BOUNDARIES);session.found=[];session.possible=3;}
  renderGame();
  clockInterval=setInterval(()=>{if(!session||session.done)return;const remaining=Math.max(0,Math.ceil((session.deadline-Date.now())/1000));if(session.mode==='challenge'&&remaining===0){finish('time');return;}const clock=document.getElementById('game-clock');if(clock){clock.textContent=formatTime(session.mode==='challenge'?remaining:Math.floor((Date.now()-session.started)/1000));clock.parentElement.classList.toggle('urgent',session.mode==='challenge'&&remaining<=20);}},1000);
}
function sessionProgress() {
  if(session.game.id==='match')return session.matched.length;
  if(session.game.id==='build')return session.placed.length;
  return session.index;
}
function sessionHeader() {
  const s=session,completed=sessionProgress();
  return `<div class="session-top"><a class="back" href="#">${icon('arrow')}All mini-games</a><div class="session-actions"><span class="pill mint">${s.mode==='challenge'?'2-MIN CHALLENGE':'PRACTICE'}</span><button class="btn ghost small" data-action="restart">Restart</button></div></div><div class="session-title"><span class="eyebrow">${s.game.category.toUpperCase()} · MODULE ${String(s.game.module).padStart(2,'0')}</span><h1>${s.game.title}</h1><p>${s.game.description}</p></div><div class="session-meter"><span class="meter-text"><strong>${completed}</strong> / ${s.possible} completed</span><div class="meter-track" role="progressbar" aria-label="Game progress" aria-valuemin="0" aria-valuemax="${s.possible}" aria-valuenow="${completed}"><span style="width:${completed/s.possible*100}%"></span></div><span class="clock">${icon('clock')}<span id="game-clock">${formatTime(s.mode==='challenge'?Math.max(0,Math.ceil((s.deadline-Date.now())/1000)):Math.floor((Date.now()-s.started)/1000))}</span><span class="sr-only">${s.mode==='challenge'?'remaining':'elapsed'}</span></span></div>`;
}
function feedbackHTML(correct,title,text,lesson) {
  return `<div class="feedback ${correct?'':'incorrect'}"><h3 tabindex="-1" id="feedback-heading">${esc(title)}</h3><p>${esc(text)}</p>${lesson?`<a href="${lessonLink(lesson)}">Review the related lesson →</a>`:''}</div>`;
}
function hintHTML(text) {
  return session.mode==='practice'?`<button class="hint-button" data-action="hint" ${session.hint?'disabled':''}>${session.hint?'Hint shown':'Need a hint?'}</button><p class="hint">${session.hint?esc(text):''}</p>`:'';
}
function nextButton(){return `<button class="btn" data-action="next">${session.index===session.items.length-1?'See results':'Next round'} ${icon('arrow')}</button>`;}
function zoneButtons(ids=ZONES.map(zone=>zone.id),placed=[]) {
  return `<div class="zone-controls" aria-label="Choose a lettered diagram zone">${ZONES.filter(zone=>ids.includes(zone.id)).map(zone=>`<button data-zone="${zone.id}" class="${placed.includes(zone.id)?'placed':''}" aria-label="Zone ${zone.letter}: ${zone.position}">${zone.letter}${placed.includes(zone.id)?' ✓':''}</button>`).join('')}</div>`;
}
function choiceVisual(item) {
  if(item.photo)return photo(item.photo,{marker:item.marker,revealed:session.answer!==null});
  if(item.part)return crossSection({highlight:item.part,letters:false});
  if(item.visual==='roro')return roroDiagram();
  if(item.shape)return bending(item.shape,session.answer!==null);
  return stabilityDiagram(item.animation,session.answer!==null);
}
function renderChoice() {
  const s=session,item=s.items[s.index],answered=s.answer!==null;
  return `<div class="game-layout"><div class="visual-board">${choiceVisual(item)}${!item.photo?'<div class="visual-caption">Schematic for learning. Colours highlight structural features; dimensions and deflections are illustrative.</div>':''}</div><section class="question-panel"><span class="eyebrow">ROUND ${s.index+1} OF ${s.items.length}</span><h2>${esc(item.prompt)}</h2>${s.game.id==='name-part'?`<label class="recall-switch"><input type="checkbox" id="recall-mode" ${recall?'checked':''} ${answered?'disabled':''}>Type the name instead of choosing</label>`:''}${recall&&s.game.id==='name-part'?`<form class="recall-form" id="recall-form"><label for="recall-answer">Your answer</label><input id="recall-answer" name="answer" autocomplete="off" maxlength="100" required ${answered?'disabled':''} value="${answered?esc(s.answer):''}" placeholder="Enter the component name"><button class="btn" ${answered?'disabled':''}>Check answer</button></form>`:`<div class="options">${item.options.map((option,index)=>`<button class="answer-option ${answered?(option===item.answer?'correct':option===s.answer?'wrong':''):''}" data-choice="${index}" ${answered?'disabled':''}><span class="option-letter">${String.fromCharCode(65+index)}</span><span>${esc(option)}</span>${answered&&option===item.answer?'<span aria-label="Correct answer">✓</span>':''}</button>`).join('')}</div>`}${answered?feedbackHTML(s.correct,s.correct?'Correct — well spotted.':`Answer: ${item.answer}`,item.explanation,item.lesson)+nextButton():hintHTML(item.hint||'Look at the visible structure and what it is designed to carry.')}</section></div>`;
}
function renderFind() {
  const s=session,item=s.items[s.index];
  return `<div class="game-layout"><div><div class="visual-board">${crossSection({interactive:!s.solved,highlight:s.solved?item.id:''})}<div class="visual-caption">Tap the structure or use the letter buttons below. A zone may show the matching member on both sides of the ship.</div></div>${zoneButtons()}</div><section class="question-panel"><span class="eyebrow">LOCATE THE COMPONENT</span><h2>Find the ${esc(item.name.toLowerCase())}.</h2><p class="intro">Choose its lettered zone in the bulk-carrier cross-section.</p>${s.solved?feedbackHTML(s.attempts[`find${s.index}`],'Located.',item.function,item.lesson)+nextButton():`${s.feedback?feedbackHTML(false,'Try another zone.',s.feedback):''}${hintHTML(item.hint)}`}</section></div>`;
}
function renderMatch() {
  const s=session;
  return `<div class="notice">Select a part on the left, then its function on the right. Matched pairs lock in place. Your first attempt for each part counts toward the score.</div><div class="match-board"><div class="match-columns"><div class="match-column"><h3>Ship part</h3>${s.items.map(part=>`<button data-match-part="${part.id}" class="${s.matched.includes(part.id)?'matched':''}" aria-pressed="${s.selected===part.id}" ${s.matched.includes(part.id)?'disabled':''}>${part.name}</button>`).join('')}</div><div class="match-column functions"><h3>Its function</h3>${s.functions.map(part=>`<button data-match-function="${part.id}" class="${s.matched.includes(part.id)?'matched':''}" ${s.matched.includes(part.id)?'disabled':''}>${part.function}</button>`).join('')}</div></div><div class="match-status" role="status">${esc(s.feedback||'Choose a part to begin.')}</div>${s.matched.length===s.items.length?'<button class="btn" data-action="finish">See results →</button>':hintHTML(s.selected?PARTS.find(part=>part.id===s.selected).hint:'Start with a part whose purpose you know. Think about the loads or motion it controls.')}</div>`;
}
function renderBuild() {
  const s=session,ids=s.items.map(part=>part.id),part=s.items.find(part=>part.id===s.selected);
  return `<div class="build-layout"><div><div class="visual-board">${crossSection({interactive:true,build:true,placed:s.placed,ids})}<div class="visual-caption">The faint outlines mark the member positions. Select a piece, then its lettered position. Mouse users can also drag a piece onto the diagram.</div></div>${zoneButtons(ids,s.placed)}</div><section class="question-panel"><span class="eyebrow">ASSEMBLY BAY</span><h2>Build the bulk carrier section.</h2><p class="selected-instruction">${part?`Selected: <strong>${part.name}</strong>. Choose its zone.`:'Select a structural piece to place.'}</p><div class="parts-tray">${s.items.map(part=>`<button class="part-token" data-build-part="${part.id}" draggable="${!s.placed.includes(part.id)}" aria-pressed="${s.selected===part.id}" ${s.placed.includes(part.id)?'disabled':''}>${s.placed.includes(part.id)?'✓ ':''}${part.name}</button>`).join('')}</div>${s.feedback?`<p class="match-status" role="status">${esc(s.feedback)}</p>`:''}${s.placed.length===s.items.length?feedbackHTML(true,'Section assembled.','You have placed the structural members that form the bulk-carrier hold and double bottom.','bulk-carrier-holds')+'<button class="btn" data-action="finish">See results →</button>':hintHTML(part?.hint||'Begin with the outer hull, then build inward. The raised hatch edge is at the top.')}</section></div>`;
}
function renderDefect() {
  const s=session,item=s.items[s.index],answered=s.answer!==null;
  return `<div class="game-layout"><div class="visual-board">${item.photo?photo(item.photo,{regions:true,revealed:answered}):defectDiagram(item.id)}${!item.photo?'<div class="visual-caption">Authored inspection illustration. Select a region using the buttons beside or below the scene.</div>':''}</div><section class="question-panel"><span class="eyebrow">INSPECTION ${s.index+1} OF ${s.items.length}</span><h2>${item.prompt}</h2><div class="options">${['A','B','C'].map(region=>`<button class="answer-option ${answered?(region===item.answer?'correct':region===s.answer?'wrong':''):''}" data-region="${region}" ${answered?'disabled':''}><span class="option-letter">${region}</span>Region ${region}${answered&&region===item.answer?' · correct':''}</button>`).join('')}</div>${answered?feedbackHTML(s.correct,s.correct?'Indication found.':`Inspect region ${item.answer}.`,item.explanation,item.lesson)+nextButton():hintHTML(item.hint)}</section></div>`;
}
function renderLoading() {
  const s=session,level=s.items[s.index],m=partialMoments(level.weights,s.placements),rows=['Fore','Midship','Aft'],cols=['Port','Centre','Starboard'];
  return `<div class="game-layout"><div class="loading-board"><div class="cargo-labels"><span>PORT −5 m</span><span>CENTRE</span><span>STARBOARD +5 m</span></div><div class="ship-top"><div class="cargo-grid">${Array.from({length:9},(_,index)=>{const cargo=s.placements.indexOf(String(index));return `<button class="cargo-cell ${cargo>=0?'occupied':''}" data-cell="${index}" aria-label="${rows[Math.floor(index/3)]} ${cols[index%3]}${cargo>=0?`, ${level.weights[cargo]} tonnes. Select to return to tray.`:'. Empty cargo position.'}" ${s.solved?'disabled':''}>${cargo>=0?`<span><strong>${level.weights[cargo]} t</strong>${rows[Math.floor(index/3)]}</span>`:`${rows[Math.floor(index/3)]}<br>${cols[index%3]}`}</button>`;}).join('')}</div></div><div class="moments"><div class="moment ${m.longitudinal===0?'zero':''}">Fore-aft moment<strong>${m.longitudinal} t·m</strong></div><div class="moment ${m.transverse===0?'zero':''}">Transverse moment<strong>${m.transverse} t·m</strong></div></div></div><section class="question-panel"><span class="eyebrow">CARGO PUZZLE ${s.index+1} OF 3</span><h2>Balance both cargo moments.</h2><p class="intro">Place all six blocks, one per cell. Fore and aft stations are +10 m and −10 m. Aim for <strong>0 t·m on both indicators</strong>. Each cell accepts up to ${level.capacity} t.</p><div class="cargo-tray">${level.weights.map((weight,index)=>`<button class="cargo-token" data-cargo="${index}" draggable="${s.placements[index]===null&&!s.solved}" aria-pressed="${s.selected===index}" ${s.placements[index]!==null||s.solved?'disabled':''}>${weight} t<small>BLOCK ${index+1}</small></button>`).join('')}</div><p class="selected-instruction">${s.selected!==null?`Block ${s.selected+1} selected. Tap an empty position.`:'Select a block, then a position. Tap a placed block to return it.'}</p>${s.solved?feedbackHTML(s.attempts[`load${s.index}`],'Cargo moments balanced.','Equal cargo moments on opposing sides cancel in this simplified model. A real loading plan also needs buoyancy, structural limits, stability and approved loading information.','local-loads')+nextButton():`<div class="puzzle-buttons"><button class="btn" data-action="check-load">Check balance</button><button class="btn secondary" data-action="clear-load">Clear positions</button></div>${s.feedback?feedbackHTML(false,'Keep adjusting.',s.feedback):''}${hintHTML('Try equal-weight blocks in diagonally opposite positions. The midship port and starboard positions can take another equal pair.')}`}<p class="intro" style="margin-top:17px;font-size:10px">Learning model: cargo moments about the marked axes only. This puzzle does not calculate a vessel’s actual trim, stability or structural loading limits.</p></section></div>`;
}
function renderWatertight() {
  const s=session,item=s.items[s.index];
  return `<div class="game-layout"><div><div class="visual-board">${boundaryDiagram(item.targets,s.found,s.solved)}<div class="visual-caption">Find all compromised points. Tap a detail or use its letter below. Details are enlarged to show the condition.</div></div><div class="region-buttons">${BOUNDARY_POINTS.map(point=>`<button data-boundary="${point.id}" class="${s.found.includes(point.id)?'found':''}" aria-label="Boundary point ${point.letter}: ${point.label}">${point.letter}${s.found.includes(point.id)?' ✓':''}</button>`).join('')}</div></div><section class="question-panel"><span class="eyebrow">BOUNDARY LAYOUT ${s.index+1} OF 3</span><h2>${item.prompt}</h2><p class="intro">${s.found.length} / ${item.targets.length} flood paths found. Sound, sealed or closed details are distractors.</p>${s.solved?feedbackHTML(s.attempts[`boundary${s.index}`],'Flood paths found.',item.explanation,'watertight')+nextButton():`${s.feedback?`<div class="notice" role="status">${esc(s.feedback)}</div>`:''}${hintHTML('Trace the thick bulkhead lines. Look for an open door leaf, a gap around a pipe, or an irregular crack through plating.')}`}</section></div>`;
}
function renderGame() {
  if(!session)return;
  const renderers={'find-part':renderFind,match:renderMatch,build:renderBuild,defect:renderDefect,loading:renderLoading,watertight:renderWatertight};
  app.innerHTML=sessionHeader()+(renderers[session.game.id]||renderChoice)();
}
function reviewItem(title,explanation,lesson,correct) { session.reviews.push({title,explanation,lesson,correct}); }
function chooseAnswer(value,typed=false) {
  const s=session;if(!s||s.done||s.answer!==null)return;
  const item=s.items[s.index],correct=typed?matchesAnswer(value,[item.answer,...item.aliases]):value===item.answer;
  s.answer=value;s.correct=correct;markFirstAttempt(s,`choice${s.index}`,correct);
  reviewItem(item.answer,item.explanation,item.lesson,correct);renderGame();announce(correct?'Correct answer.':`Correct answer: ${item.answer}.`);document.getElementById('feedback-heading')?.focus({preventScroll:true});
}
function chooseZone(id) {
  const s=session;if(!s||s.done)return;
  if(s.game.id==='find-part') {
    if(s.solved)return;const item=s.items[s.index],correct=id===item.id;
    markFirstAttempt(s,`find${s.index}`,correct);
    if(correct){s.solved=true;s.feedback='';reviewItem(item.name,item.function,item.lesson,s.attempts[`find${s.index}`]);}
    else s.feedback=`Zone ${ZONES.find(zone=>zone.id===id)?.letter} is not the requested part. Look again at its position and shape.`;
    renderGame();announce(correct?'Correct location.':s.feedback);
  } else if(s.game.id==='build') {
    if(s.placed.includes(id))return;
    if(!s.selected){s.feedback='Select a structural piece from the tray first.';renderGame();announce(s.feedback);return;}
    const part=s.items.find(part=>part.id===s.selected),correct=id===s.selected;
    markFirstAttempt(s,`build${s.selected}`,correct);
    if(correct){s.placed.push(part.id);reviewItem(part.name,part.function,part.lesson,s.attempts[`build${part.id}`]);s.selected=null;s.hint=false;s.feedback=`${part.name} placed. ${part.function}`;}
    else s.feedback=`That zone belongs to another structure. Keep ${part.name.toLowerCase()} selected and try its correct position.`;
    renderGame();announce(s.feedback);
  }
}
function chooseBoundary(id) {
  const s=session;if(!s||s.game.id!=='watertight'||s.done||s.solved||s.found.includes(id))return;
  const item=s.items[s.index];
  if(item.targets.includes(id)){s.found.push(id);s.feedback='Flood path found. Continue tracing the other boundaries.';
    if(s.found.length===item.targets.length){s.solved=true;markFirstAttempt(s,`boundary${s.index}`,true);reviewItem(`Boundary layout ${s.index+1}`,item.explanation,'watertight',s.attempts[`boundary${s.index}`]);}
  } else {markFirstAttempt(s,`boundary${s.index}`,false);s.feedback='This detail is intact or properly closed in this layout. Look for an opening, gap or crack through a boundary.';}
  renderGame();announce(s.solved?'All flood paths found.':s.feedback);
}
function matchFunction(id) {
  const s=session;if(!s||s.game.id!=='match'||s.done||s.matched.includes(id))return;
  if(!s.selected){s.feedback='Select a part on the left first.';renderGame();announce(s.feedback);return;}
  const part=s.items.find(part=>part.id===s.selected),correct=s.selected===id;
  markFirstAttempt(s,`match${part.id}`,correct);
  if(correct){s.matched.push(part.id);reviewItem(part.name,part.function,part.lesson,s.attempts[`match${part.id}`]);s.selected=null;s.hint=false;s.feedback=`Matched: ${part.name}. ${part.function}`;}
  else s.feedback=`That function does not match ${part.name.toLowerCase()}. Try another function.`;
  renderGame();announce(s.feedback);
}
function placeCargo(id) {
  const s=session;if(!s||s.game.id!=='loading'||s.done||s.solved)return;
  const existing=s.placements.indexOf(id);
  if(existing>=0){s.placements[existing]=null;s.selected=existing;s.feedback='Block returned to the tray. Choose another position.';}
  else if(s.selected===null){s.feedback='Select a cargo block from the tray first.';}
  else {s.placements[s.selected]=id;s.selected=null;s.feedback='';}
  renderGame();announce(s.feedback||'Cargo block placed. Moment indicators updated.');
}
function checkLoad() {
  const s=session,level=s.items[s.index];if(s.solved)return;
  if(s.placements.some(cell=>cell===null)){s.feedback='Place every block before checking. Empty positions are allowed; unplaced blocks are not.';renderGame();announce(s.feedback);return;}
  const result=loadingBalance(level.weights,s.placements,level.capacity);markFirstAttempt(s,`load${s.index}`,result.balanced);
  if(result.balanced){s.solved=true;reviewItem(`Loading puzzle ${s.index+1}`,'Opposing cargo moments cancel when the fore-aft and transverse sums are both zero. This is a simplified cargo-balance exercise.','local-loads',s.attempts[`load${s.index}`]);}
  else s.feedback=`The moments are ${result.longitudinal} t·m fore-aft and ${result.transverse} t·m transverse. Move blocks until both read zero.`;
  renderGame();announce(result.balanced?'Both cargo moments are balanced.':s.feedback);
}
function nextRound() {
  const s=session;if(!s||s.done||(!s.solved&&s.answer===null))return;
  if(s.index===s.items.length-1){finish();return;}
  s.index++;s.answer=null;s.solved=false;s.correct=false;s.feedback='';s.hint=false;s.selected=null;
  if(s.game.id==='loading')s.placements=Array(6).fill(null);
  if(s.game.id==='watertight')s.found=[];
  renderGame();focusMain();window.scrollTo({top:0,behavior:'instant'});
}
function finish(reason='complete') {
  const s=session;if(!s||s.done)return;
  clearInterval(clockInterval);s.done=true;s.reason=reason;s.elapsed=Math.max(1,Math.round((Date.now()-s.started)/1000));
  try { progress=readProgress(localStorage.getItem(PROGRESS_KEY)); } catch { storageOK=false; }
  progress=recordResult(progress,s.game.id,s.mode,s.earned,s.possible);
  try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));}catch{storageOK=false;}
  renderResult();focusMain();window.scrollTo({top:0,behavior:'instant'});announce(reason==='time'?'Time is up. Your results are ready.':'Game complete. Your results are ready.');
}
function renderResult() {
  const s=session,score=scorePercent(s.earned,s.possible),unfinished=s.possible-s.reviews.length;
  app.innerHTML=`<div class="session-top"><a class="back" href="#">${icon('arrow')}All mini-games</a><span class="pill mint">${s.mode.toUpperCase()}</span></div><section class="result-hero"><span class="eyebrow">${s.game.title.toUpperCase()}</span><h1>${s.reason==='time'?'Time’s up. Keep practising.':score===100?'Shipshape. Every first try correct.':'Another step toward knowing your ship.'}</h1><div class="score-ring"><strong>${score}%</strong><small>FIRST-TRY SCORE</small></div><p>${s.earned} of ${s.possible} first attempts correct · ${formatTime(s.elapsed)} elapsed.${unfinished>0?` ${unfinished} unfinished item${unfinished===1?'':'s'} counted toward the full game total.`:''} ${storageOK?'Your result is saved on this device.':'Your browser could not save this result.'}</p><div class="result-actions"><button class="btn" data-action="restart">Play again ${icon('arrow')}</button><a class="btn secondary" href="#">Choose another game</a><a class="btn ghost" href="${lessonLink(s.game.lesson)}">Review this topic</a></div></section><div class="section-head"><div><h2>Take the learning with you</h2><p>Review the structure, function and reasoning behind each round.</p></div></div><div class="review-list">${s.reviews.length?s.reviews.map((item,index)=>`<article class="review-item ${item.correct?'good':''}"><h3>${item.correct?'✓':'↻'} ${index+1}. ${esc(item.title)}</h3><p>${esc(item.explanation)}</p><a class="text-link" href="${lessonLink(item.lesson)}">Open related lesson →</a></article>`).join(''):`<div class="info-card"><p>No rounds were completed. Try Practice mode to explore the diagram and read the hints at your own pace.</p><a class="text-link" href="${lessonLink(s.game.lesson)}">Study this topic →</a></div>`}</div><div class="notice">Practice records stay in this browser and do not change your lecturer’s Classroom quiz results. A completed puzzle can still have a lower first-try score when you used retries.</div>`;
}
function renderCredits() {
  app.innerHTML=`<div class="session-top"><a class="back" href="#">${icon('arrow')}All mini-games</a></div><div class="session-title"><span class="eyebrow">LEARNING RESOURCES</span><h1>Photos & references</h1><p>Real ship photographs alongside original, simplified teaching diagrams.</p></div><div class="credits-list">${Object.values(PHOTOS).map(photo=>`<article class="credit-row"><img src="${photo.src}" alt="${esc(photo.title)}" loading="lazy"><div><h3>${esc(photo.title)}</h3><p>Photo: <a href="${photo.source}" target="_blank" rel="noopener noreferrer">${esc(photo.author)} · original on Wikimedia Commons</a><br><a href="${photo.licenseURL}" target="_blank" rel="noopener noreferrer">${photo.license}</a>. Display scaled; original photo not retouched. Training overlays sit above the photograph.</p></div></article>`).join('')}</div><div class="info-card" style="margin-top:24px"><h3>Course and concept references</h3><p>Games follow the Academy’s ship construction lessons. Structural bending and initial stability examples are simplified teaching models. Real loading, stability and inspection decisions require the vessel’s approved information and procedures.</p><p><a class="text-link" href="https://www.gov.uk/government/publications/chief-engineer-written-examination-syllabuses/naval-architecture-written-examination-syllabus" target="_blank" rel="noopener noreferrer">Maritime & Coastguard Agency · Naval Architecture syllabus →</a></p><p><a class="text-link" href="https://publishing.vt.edu/books/63/files/9bc9a262-a20f-4022-9532-4926bb773426.pdf" target="_blank" rel="noopener noreferrer">Virginia Tech · Ship longitudinal bending, Figure 4.14 →</a></p><a class="text-link" href="index.html#academy">ShipStruct Academy course modules →</a></div>`;
}
function route() {
  const id=location.hash.slice(1);clearInterval(clockInterval);session=null;
  if(id==='credits')renderCredits();else if(GAMES.some(game=>game.id===id))startGame(id);else renderHub();
  focusMain();window.scrollTo({top:0,behavior:'instant'});
}

app.addEventListener('click',event=>{
  const target=event.target.closest('button,[data-zone],[data-boundary]');if(!target||target.disabled)return;
  if(target.dataset.filter){category=target.dataset.filter;renderHub();return;}
  if(!session||session.done){if(target.dataset.action==='restart'&&session)startGame(session.game.id);return;}
  if(session.mode==='challenge'&&Date.now()>=session.deadline){finish('time');return;}
  const s=session,action=target.dataset.action;
  if(target.dataset.choice!==undefined){chooseAnswer(s.items[s.index].options[Number(target.dataset.choice)]);return;}
  if(target.dataset.zone){chooseZone(target.dataset.zone);return;}
  if(target.dataset.region&&s.game.id==='defect'){chooseAnswer(target.dataset.region);return;}
  if(target.dataset.boundary){chooseBoundary(target.dataset.boundary);return;}
  if(target.dataset.matchPart){s.selected=target.dataset.matchPart;s.hint=false;s.feedback='Part selected. Now choose its function.';renderGame();return;}
  if(target.dataset.matchFunction){matchFunction(target.dataset.matchFunction);return;}
  if(target.dataset.buildPart){s.selected=target.dataset.buildPart;s.hint=false;s.feedback='';renderGame();return;}
  if(target.dataset.cargo!==undefined){s.selected=Number(target.dataset.cargo);s.feedback='';renderGame();return;}
  if(target.dataset.cell!==undefined){placeCargo(target.dataset.cell);return;}
  if(action==='restart')startGame(s.game.id);
  if(action==='next')nextRound();
  if(action==='finish'&&((s.game.id==='build'&&s.placed.length===s.possible)||(s.game.id==='match'&&s.matched.length===s.possible)))finish();
  if(action==='hint'){s.hint=true;renderGame();const hint=app.querySelector('.hint');if(hint)announce(hint.textContent);}
  if(action==='check-load'&&s.game.id==='loading')checkLoad();
  if(action==='clear-load'&&s.game.id==='loading'&&!s.solved){s.placements=Array(6).fill(null);s.selected=null;s.feedback='Positions cleared. Your first check remains recorded.';renderGame();}
});
app.addEventListener('change',event=>{
  if(event.target.id==='play-mode'){mode=event.target.value;renderHub();}
  if(event.target.id==='recall-mode'){recall=event.target.checked;renderGame();if(recall)document.getElementById('recall-answer')?.focus({preventScroll:true});}
});
app.addEventListener('submit',event=>{
  if(event.target.id!=='recall-form')return;event.preventDefault();
  if(session?.mode==='challenge'&&Date.now()>=session.deadline){finish('time');return;}
  const input=document.getElementById('recall-answer');if(input?.value.trim())chooseAnswer(input.value.trim(),true);
});
app.addEventListener('keydown',event=>{
  const target=event.target.closest('[role="button"][data-zone],[role="button"][data-boundary]');
  if(target&&['Enter',' '].includes(event.key)){event.preventDefault();target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
});
app.addEventListener('dragstart',event=>{
  const target=event.target.closest('[draggable="true"]');if(!target||!session||session.done)return;
  if(target.dataset.buildPart){session.selected=target.dataset.buildPart;event.dataTransfer.setData('text/plain',`part:${target.dataset.buildPart}`);}
  else if(target.dataset.cargo!==undefined){session.selected=Number(target.dataset.cargo);event.dataTransfer.setData('text/plain',`cargo:${target.dataset.cargo}`);}
  event.dataTransfer.effectAllowed='move';
});
app.addEventListener('dragover',event=>{if(event.target.closest('[data-zone],[data-cell]')){event.preventDefault();event.dataTransfer.dropEffect='move';}});
app.addEventListener('drop',event=>{
  const zone=event.target.closest('[data-zone]'),cell=event.target.closest('[data-cell]');if(!session||session.done)return;
  if(session.mode==='challenge'&&Date.now()>=session.deadline){finish('time');return;}
  const data=event.dataTransfer.getData('text/plain');
  if(zone&&session.game.id==='build'&&data===`part:${session.selected}`){event.preventDefault();chooseZone(zone.dataset.zone);}
  if(cell&&session.game.id==='loading'&&data===`cargo:${session.selected}`){event.preventDefault();placeCargo(cell.dataset.cell);}
});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();focusMain();});
window.addEventListener('hashchange',route);
window.addEventListener('pagehide',()=>clearInterval(clockInterval));
window.addEventListener('pageshow',event=>{if(event.persisted)route();});
route();
