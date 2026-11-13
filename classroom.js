/* ShipStruct Academy classroom. No private answer keys are stored here. */
(() => {
'use strict';
const $ = (sel) => document.querySelector(sel);
const view = $('#view');
const identity = $('#identity');
const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notice = (msg, type='') => `<div role="status" class="notice ${type}">${escapeHTML(msg)}</div>`;
const pill = (status) => `<span class="chip"><strong>${escapeHTML(status)}</strong></span>`;
const button = (label, action, cls='', extra='') => `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
const conf = window.SHIPSTRUCT_CONFIG || {};
let supa = null;
let user = null;
let profile = null;
let currentScreen = 'auth';
let sessions = [];
let chosen = null;
let active = null;
let picked = [];
let createDraft = emptyDraft();
let ticker = null;
let busy = false;
let message = '';
function emptyDraft(){return {title:'',duration:20,questions:[emptyQuestion(),emptyQuestion()]};}
function emptyQuestion(){return {prompt:'',choices:['','','',''],correct_index:0,explanation:''};}
const isConfigured = () => /^https:\/\/[^\s]+\.supabase\.co\/?$/.test(conf.supabaseUrl||'') &&
  typeof conf.supabasePublishableKey==='string' && conf.supabasePublishableKey.length>20 && !conf.supabasePublishableKey.startsWith('YOUR_');
function setMessage(err) { message=String(err?.message || err || 'Unexpected error'); }
function topbar() {
  identity.innerHTML = user ? `<span class="subtle">${escapeHTML(profile?.full_name || user.email)} (${escapeHTML(profile?.role || 'cadet')})</span> ${button('Sign out','signout','alt')}` : '';
}
function showConfig(){
  view.innerHTML = `<section class="hero"><h1>Classroom setup required</h1><p>The public study area still works. The classroom needs a Supabase project before users can register and share results.</p></section>
    <div class="card"><h2>Connect the classroom database</h2><p>1. Create a Supabase project. 2. Run <code>supabase_schema.sql</code> in SQL Editor. 3. Open <code>config.js</code> and replace the URL and publishable key placeholders. 4. Redeploy these files to Vercel.</p>
    ${notice('Never put a Supabase service_role key or database password in config.js.','warn')}
    <a class="btn alt" href="index.html">Continue learning without an account</a></div>`;
}
function authPage(mode='login'){
  currentScreen='auth'; topbar();
  let signup=mode==='register';
  view.innerHTML = `<section class="hero"><h1>${signup?'Create a ShipStruct account':'Welcome to ShipStruct Classroom'}</h1><p>Join online ship-construction assessments with your cadet or lecturer account.</p></section>
    <div class="card auth"><div class="toolbar">${button('Sign in','show-login',signup?'alt':'')}${button('Register','show-register',signup?'':'alt')}</div>
    ${message?notice(message,message.toLowerCase().includes('confirm')?'':'error'):''}
    <form id="authForm">
      ${signup?`<label class="field"><span>Full name</span><input name="name" required minlength="2" maxlength="100" autocomplete="name" placeholder="Name for quiz results"></label>`:''}
      <label class="field"><span>Email address</span><input type="email" name="email" required autocomplete="email" placeholder="name@example.com"></label>
      <label class="field"><span>Password</span><input type="password" name="password" required minlength="8" autocomplete="${signup?'new-password':'current-password'}" placeholder="At least 8 characters"></label>
      ${signup?`<label class="field"><span>Requested account type</span><select name="role"><option value="cadet">Cadet</option><option value="lecturer">Lecturer (requires administrator approval)</option></select></label><p class="subtle">New accounts start as cadets. Lecturers must be approved by the academy administrator before creating examinations.</p>`:''}
      <button type="submit" class="btn">${signup?'Create account':'Sign in'}</button>
    </form>
    <div class="divider"></div><a href="index.html" class="subtle">← Browse free lessons without signing in</a></div>`;
  $('#authForm').onsubmit = e => {e.preventDefault(); submitAuth(e.target,signup);};
}
async function submitAuth(form,signup){
  if(busy) return;
  busy=true; message='';
  const data=new FormData(form), email=String(data.get('email')).trim(),password=String(data.get('password'));
  try {
    if(signup){
      const {data:result,error}=await supa.auth.signUp({email,password,options:{
        data:{full_name:String(data.get('name')).trim(),requested_role:data.get('role')},
        emailRedirectTo:window.location.origin+'/classroom.html'
      }});
      if(error) throw error;
      message = result.session ? 'Registration successful. Your account is ready.' : 'Registration received. Please check your email and confirm your account before signing in.';
      if(!result.session){authPage('login');return;}
    } else {
      const {error}=await supa.auth.signInWithPassword({email,password});
      if(error) throw error;
    }
    await loadIdentity();
  } catch(err){setMessage(err); authPage(signup?'register':'login');}
  finally{busy=false;}
}
async function loadIdentity(){
  if(!supa)return;
  try {
    const {data:sessionData,error:sessionError}=await supa.auth.getSession();
    if(sessionError)throw sessionError;
    if(!sessionData.session){user=null;profile=null;message='';authPage('login');return;}
    const {data,error}=await supa.auth.getUser();
    if(error) throw error;
    user=data.user;
    if(user){
      const {data:p,error:pe}=await supa.from('shipstruct_profiles').select('id,full_name,role,requested_role').eq('id',user.id).single();
      if(pe) throw pe;
      profile=p;
      await dashboard();
    } else {profile=null;authPage('login');}
  }catch(err){setMessage(err);user=null;profile=null;authPage('login');}
}
function sectionHeader(title, subtitle){return `<section class="hero"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(subtitle)}</p></section>`;}
async function dashboard(){
  currentScreen='dashboard';topbar();
  try {
    if(profile?.role==='lecturer') {
      const {data,error}=await supa.from('shipstruct_quizzes').select('id,title,join_code,status,duration_minutes,started_at,created_at').eq('lecturer_id',user.id).order('created_at',{ascending:false});
      if(error)throw error;
      sessions=data||[];
      view.innerHTML=sectionHeader('Lecturer dashboard','Build assessments, launch live quiz sessions and review cadet results.')+
      `<div class="toolbar">${button('＋ Create new quiz','new-quiz')}${button('Refresh','refresh','alt')}</div>`+
      `<h2>Your examinations</h2>${sessions.length?sessions.map(s=>`<div class="session"><div><h3>${escapeHTML(s.title)}</h3><p>Code ${escapeHTML(s.join_code)} · ${s.duration_minutes} minutes · ${escapeHTML(s.status)}</p></div>${button('Manage →','manage-quiz','alt',`data-id="${s.id}"`)}</div>`).join(''):`<div class="card">No examinations yet. Create your first quiz and share the join code with cadets after starting it.</div>`}`;
    } else {
      const {data,error}=await supa.from('shipstruct_quiz_attempts').select('quiz_id,joined_at,submitted_at,score,total,shipstruct_quizzes(title,status,join_code,started_at,duration_minutes)').eq('cadet_id',user.id).order('joined_at',{ascending:false});
      if(error)throw error;
      sessions=data||[];
      let pending = profile?.requested_role==='lecturer' ? notice('Lecturer approval is pending. You can join quizzes as a cadet until an administrator approves your account.','warn') : '';
      view.innerHTML=sectionHeader('Cadet dashboard','Use the quiz code shared by your lecturer. Your results are stored securely with your account.')+
      pending+`<div class="card"><h2>Join a live quiz</h2><form id="joinForm"><label class="field"><span>8-character session code</span><input name="code" type="text" maxlength="8" minlength="8" required placeholder="e.g. A12B34CD" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:3px;font-weight:800"></label><button type="submit" class="btn">Join quiz →</button></form></div>
      <h2>My quiz history</h2>${sessions.length?sessions.map(x=>`<div class="session"><div><h3>${escapeHTML(x.shipstruct_quizzes?.title||'Quiz')}</h3><p>${x.submitted_at?`Submitted · ${x.score}/${x.total} (${Math.round(100*x.score/x.total)}%)`:`Not submitted · ${escapeHTML(x.shipstruct_quizzes?.status||'Unknown status')}`}</p></div>${x.submitted_at?pill('Graded'):button('Resume →','resume-quiz','alt',`data-id="${x.quiz_id}"`)}</div>`).join(''):`<div class="card">No quiz attempts yet. Enter a live session code to get started.</div>`}`+
      `<div class="toolbar">${button('Refresh account status','refresh','alt')}</div>`;
      $('#joinForm').onsubmit=e=>{e.preventDefault();joinQuiz(new FormData(e.target).get('code'));};
    }
  }catch(err){setMessage(err);view.innerHTML=sectionHeader('Connection problem','Unable to load classroom records')+notice(message,'error')+button('Try again','refresh','alt');}
}
function renderDraft(){
  currentScreen='create';topbar();
  view.innerHTML=sectionHeader('Create examination','Add your questions and answer key. Correct answers are saved to the secure database, not exposed to cadets.')+
    `<div class="toolbar">${button('← Lecturer dashboard','refresh','alt')}${button('Add question','add-question','alt')}${button('Load 5 sample questions','load-sample','alt')}</div>
    <form id="createForm"><div class="card"><div class="split"><label class="field"><span>Examination title</span><input id="draftTitle" required minlength="4" maxlength="120" placeholder="Ship Construction — Module 2" value="${escapeHTML(createDraft.title)}"></label><label class="field"><span>Time limit (minutes)</span><input id="draftTime" type="number" min="5" max="180" value="${createDraft.duration}" required></label></div></div>
    <div id="draftQuestions">${createDraft.questions.map((q,i)=>questionEditor(q,i)).join('')}</div>
    ${message?notice(message,'error'):''}<div class="toolbar"><button class="btn" type="submit">Save draft quiz</button>${button('Add question','add-question','alt')}</div></form>`;
  $('#createForm').onsubmit=e=>{e.preventDefault();saveQuiz();};
}
function questionEditor(q,i){return `<div class="qcard" data-q="${i}"><div class="toolbar" style="justify-content:space-between"><strong>Question ${i+1}</strong>${button('Remove','remove-question','danger',`data-index="${i}" ${createDraft.questions.length<=1?'disabled':''}`)}</div>
  <label class="field"><span>Question statement</span><textarea required minlength="8" maxlength="500" data-idx="${i}" data-field="prompt" placeholder="e.g. What is the purpose of the centre girder?">${escapeHTML(q.prompt)}</textarea></label>
  <div class="split"><div>${q.choices.map((choice,j)=>`<label class="field"><span>Option ${'ABCD'[j]}</span><input required maxlength="200" data-idx="${i}" data-choice="${j}" value="${escapeHTML(choice)}" placeholder="Option ${'ABCD'[j]}"></label>`).join('')}</div>
  <div><label class="field"><span>Correct option</span><select data-idx="${i}" data-field="correct_index">${[0,1,2,3].map(j=>`<option value="${j}" ${Number(q.correct_index)===j?'selected':''}>${'ABCD'[j]}</option>`).join('')}</select></label>
  <label class="field"><span>Optional feedback / explanation</span><textarea maxlength="500" data-idx="${i}" data-field="explanation" placeholder="Explain the engineering principle after the quiz.">${escapeHTML(q.explanation)}</textarea></label></div></div></div>`;}
function setDraftField(target){
  if(target.id==='draftTitle'){createDraft.title=target.value;return;}
  if(target.id==='draftTime'){createDraft.duration=Number(target.value);return;}
  const i=Number(target.dataset.idx);
  if(!Number.isInteger(i)||!createDraft.questions[i])return;
  if(target.dataset.choice!==undefined){createDraft.questions[i].choices[Number(target.dataset.choice)]=target.value;return;}
  if(target.dataset.field){createDraft.questions[i][target.dataset.field]=target.dataset.field==='correct_index'?Number(target.value):target.value;}
}
const examples=[
 {prompt:'What is the primary role of a centre girder in a double bottom?',choices:['Provide a longitudinal load path and support','Ventilate cargo spaces','Reduce propeller cavitation','Control the rudder angle'],correct_index:0,explanation:'The centre girder is a structural longitudinal member that supports inner and outer bottom plating through the floor arrangement.'},
 {prompt:'Which best describes a watertight bulkhead?',choices:['A decorative accommodation partition','A boundary designed to prevent water passage under specified conditions','A nonstructural paint coating','A hatch cover drain channel'],correct_index:1,explanation:'Watertight subdivision boundaries are designed to restrict flooding under their specified design conditions.'},
 {prompt:'Which structural condition is called sagging?',choices:['The ship bends with its middle relatively lower than its ends','The propeller shaft rotates faster','The middle of the hull bends upward','The ship heels to starboard'],correct_index:0,explanation:'Sagging is a hull-girder bending condition in which the midship region is relatively lower than the ends.'},
 {prompt:'What is the tank top on a typical bulk carrier?',choices:['The hatch cover outer skin','The inner bottom plating supporting the cargo hold floor','The ship superstructure roof','The top of a lifeboat tank'],correct_index:1,explanation:'The tank top forms the inner bottom, often supporting cargo loads in a bulk carrier hold.'},
 {prompt:'What should an engine cadet do after observing an apparent crack near a main engine seating?',choices:['Paint over the line immediately','Weld a reinforcement while the engine is running','Record the observation and report it to the responsible engineer','Ignore it if no water is present'],correct_index:2,explanation:'A foundation defect may affect machinery alignment and support and must be assessed through approved procedures.'}
];
async function saveQuiz(){
  if(busy)return; busy=true; message='';
  try {
    const questions=createDraft.questions;
    if(questions.some(q=>q.prompt.trim().length<8 || q.choices.some(x=>x.trim().length===0) || q.choices.length!==4)) throw new Error('Please complete every question and all four choices.');
    const {data,error}=await supa.rpc('shipstruct_create_quiz',{p_title:createDraft.title.trim(),p_duration_minutes:Number(createDraft.duration),p_questions:questions});
    if(error)throw error;
    createDraft=emptyDraft(); chosen=data.id;
    await manageQuiz(chosen);
  }catch(err){setMessage(err);renderDraft();}finally{busy=false;}
}
async function manageQuiz(id){
  currentScreen='manage';chosen=id;topbar();
  try {
    const {data,error}=await supa.from('shipstruct_quizzes').select('*').eq('id',id).single();
    if(error)throw error;
    const s=data; const {data:qs,error:qe}=await supa.from('shipstruct_quiz_questions').select('position,prompt,choices,correct_index,explanation').eq('quiz_id',id).order('position');
    if(qe)throw qe;
    view.innerHTML=sectionHeader(s.title,'A quiz becomes joinable when you press Start. Cadets use the code on this page.')+
      `<div class="toolbar">${button('← Dashboard','refresh','alt')}${button('View results','results','alt',`data-id="${s.id}"`)}</div><div class="card"><div class="stats">${pill(s.status)}<span class="chip">${s.duration_minutes} minutes</span><span class="chip">${qs.length} questions</span></div>
      <p class="subtle">Session code (share with cadets after starting):</p><div class="code">${escapeHTML(s.join_code)}</div>
      <div class="toolbar">${button('Copy code','copy-code','alt',`data-code="${escapeHTML(s.join_code)}"`)}${s.status==='draft'?button('▶ Start quiz','start-quiz','',`data-id="${s.id}"`):''}${s.status==='live'?button('■ Close quiz','close-quiz','danger',`data-id="${s.id}"`):''}${button('Refresh','refresh-manage','alt',`data-id="${s.id}"`)}</div>
      ${s.status==='live'?notice('The quiz timer started for the whole class. Late joiners have less time remaining.'):''}${s.status==='closed'?notice('This quiz is closed. New submissions are not accepted.'):''}</div>
      <h2>Question preview (lecturer only)</h2>${qs.map((q,i)=>`<div class="qcard"><h3>${i+1}. ${escapeHTML(q.prompt)}</h3><ol type="A">${q.choices.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ol><p class="subtle">Correct answer: ${'ABCD'[q.correct_index]}</p></div>`).join('')}`;
  }catch(err){setMessage(err);view.innerHTML=notice(message,'error')+button('Return to dashboard','refresh','alt');}
}
async function changeStatus(id,start){
  if(busy)return; busy=true;
  try {
    const {error}=await supa.rpc(start?'shipstruct_start_quiz':'shipstruct_close_quiz',{p_quiz_id:id});
    if(error)throw error;
    await manageQuiz(id);
  }catch(err){setMessage(err);alert(message);}finally{busy=false;}
}
async function showResults(id){
  currentScreen='results';chosen=id;
  try {
    const {data,error}=await supa.rpc('shipstruct_quiz_results',{p_quiz_id:id});
    if(error)throw error;
    let rows=data.results||[];
    view.innerHTML=sectionHeader('Exam results: '+data.title,'Live overview of registered cadets and submitted scores.')+
      `<div class="toolbar">${button('← Manage quiz','refresh-manage','alt',`data-id="${id}"`)}${button('Refresh scores','results','alt',`data-id="${id}"`)}${button('Export CSV','export-csv','alt')}</div>
      <div class="grid"><div class="card flat"><h3>Joined cadets</h3><div class="score">${data.stats.joined}</div></div><div class="card flat"><h3>Submitted</h3><div class="score">${data.stats.submitted}</div></div><div class="card flat"><h3>Average score</h3><div class="score">${data.stats.average_percent}%</div></div></div>
      <div class="card"><div class="toolbar">${pill(data.status)}<span class="chip">Code: ${escapeHTML(data.code)}</span></div><h2>Cadet results</h2>
      <div class="table-wrap"><table><thead><tr><th>Cadet</th><th>Status</th><th>Score</th><th>Percentage</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${escapeHTML(r.name)}</td><td>${r.submitted_at?'Submitted':'In progress'}</td><td>${r.score===null?'—':`${r.score} / ${r.total}`}</td><td>${r.percent===null?'—':r.percent+'%'}</td></tr>`).join(''):'<tr><td colspan="4">No cadets have joined yet.</td></tr>'}</tbody></table></div></div>`;
    window.shipstructCSV=()=>{
      const dataRows=[['Cadet','Status','Score','Total','Percentage'],...rows.map(r=>[r.name,r.submitted_at?'Submitted':'In progress',r.score??'',r.total??'',r.percent??''])];
      const csv=dataRows.map(row=>row.map(v=>'"'+String(v).replace(/^\s*[=+\-@]/, match => "'" + match).replace(/"/g,'""')+'"').join(',')).join('\r\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='shipstruct-results-'+data.code+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    };
  }catch(err){setMessage(err);view.innerHTML=notice(message,'error')+button('Return to dashboard','refresh','alt');}
}
async function joinQuiz(code){
  if(busy)return; busy=true;
  try {
    const normalized=String(code||'').trim().toUpperCase();
    if(!/^[A-F0-9]{8}$/.test(normalized))throw new Error('The session code should contain 8 letters/numbers.');
    const {data,error}=await supa.rpc('shipstruct_join_quiz',{p_code:normalized});
    if(error)throw error;
    if(data.submitted) { await dashboard();alert('You already submitted this quiz. Your result appears in your history.');}
    else await openQuiz(data.id);
  }catch(err){setMessage(err);alert(message);}finally{busy=false;}
}
async function openQuiz(id){
  currentScreen='take';topbar();
  try {
    const {data,error}=await supa.rpc('shipstruct_get_questions',{p_quiz_id:id});
    if(error)throw error;
    active=data;
    picked=data.questions.map(()=>null);
    renderQuiz();
  }catch(err){setMessage(err);view.innerHTML=sectionHeader('Quiz unavailable','Your answers may have been submitted or the examination has ended.')+notice(message,'warn')+button('My dashboard','refresh','alt');}
}
function renderQuiz(){
  if(ticker){clearInterval(ticker);ticker=null;}
  if(!active)return;
  view.innerHTML=sectionHeader(active.title,'Select an answer for each question, then submit before the time limit expires.')+
    `<div class="card"><div class="toolbar" style="justify-content:space-between"><strong>Time remaining</strong><span class="code" id="timer" style="font-size:24px">--:--</span></div><div class="subtle">You can leave unanswered questions blank. The timer is based on when the lecturer started the examination.</div></div>`+
    active.questions.map((q,i)=>`<div class="qcard"><h3>${i+1}. ${escapeHTML(q.prompt)}</h3><div class="choices">${q.choices.map((x,j)=>`<button type="button" class="choice ${picked[i]===j?'selected':''}" data-action="answer" data-question="${i}" data-choice="${j}"><strong>${'ABCD'[j]}.</strong> ${escapeHTML(x)}</button>`).join('')}</div></div>`).join('')+
    `<div class="toolbar">${button('Submit final answers','submit-quiz')}${button('Return to dashboard','refresh','alt')}</div>`;
  const tick=()=>{if(currentScreen!=='take'||!active)return;
    const remain=Math.max(0,Math.floor((Date.parse(active.ends_at)-Date.now())/1000));
    const el=$('#timer');if(el){el.textContent=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(remain%60).padStart(2,'0')}`;el.style.color=remain<60?'#f6c67f':'var(--mint)';}
    if(remain===0){clearInterval(ticker);ticker=null;const actions=view.querySelectorAll('[data-action="submit-quiz"],[data-action="answer"]');actions.forEach(x=>x.disabled=true);}
  };tick();ticker=setInterval(tick,1000);
}
async function submitQuiz(){
  if(busy||!active)return;
  const unanswered=picked.filter(x=>x===null).length;
  if(unanswered && !window.confirm(`${unanswered} question(s) are unanswered. Submit anyway?`))return;
  if(!unanswered && !window.confirm('Submit these answers? You cannot change them afterward.'))return;
  busy=true;
  try {
    const {data,error}=await supa.rpc('shipstruct_submit_quiz',{p_quiz_id:active.id,p_answers:picked});
    if(error)throw error;
    clearInterval(ticker);ticker=null;active=null;currentScreen='submitted';
    view.innerHTML=sectionHeader('Quiz submitted','Your results have been saved to your account.')+
      `<div class="card center"><p class="subtle">Your score</p><div class="score">${data.score} / ${data.total}</div><h2>${data.percent}%</h2><p>Results are available to the lecturer who ran this quiz.</p>${button('Return to dashboard','refresh','alt')}</div>`;
  }catch(err){setMessage(err);alert('Submission failed: '+message);}finally{busy=false;}
}
async function bootstrap(){
  if(!isConfigured()){showConfig();return;}
  try {
    // Only load Supabase when Classroom is opened; main lessons remain fast and dependency-free.
    const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supa=mod.createClient(conf.supabaseUrl,conf.supabasePublishableKey);
    supa.auth.onAuthStateChange(()=>{setTimeout(()=>loadIdentity(),0);});
    await loadIdentity();
  }catch(err){setMessage(err);view.innerHTML=sectionHeader('Cannot connect to classroom','Please check your connection and Supabase configuration.')+notice(message,'error')+button('Retry','retry','alt');}
}
document.addEventListener('input',e=>{if(currentScreen==='create')setDraftField(e.target);});
document.addEventListener('change',e=>{if(currentScreen==='create')setDraftField(e.target);});
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action,id=el.dataset.id;
  if(action==='show-login'){message='';authPage('login');}
  else if(action==='show-register'){message='';authPage('register');}
  else if(action==='signout'){if(supa){const {error}=await supa.auth.signOut();if(error){setMessage(error);alert(message);}else {user=null;profile=null;authPage('login');}}}
  else if(action==='refresh'){await loadIdentity();}
  else if(action==='retry'){await bootstrap();}
  else if(action==='new-quiz'){createDraft=emptyDraft();message='';renderDraft();}
  else if(action==='add-question'){createDraft.questions.push(emptyQuestion());renderDraft();}
  else if(action==='remove-question'&&createDraft.questions.length>1){createDraft.questions.splice(Number(el.dataset.index),1);renderDraft();}
  else if(action==='load-sample'){createDraft.title='Ship Construction — Sample Exam';createDraft.duration=15;createDraft.questions=examples.map(q=>({...q,choices:[...q.choices]}));renderDraft();}
  else if(action==='manage-quiz'){await manageQuiz(id);}
  else if(action==='refresh-manage'){await manageQuiz(id);}
  else if(action==='start-quiz'){if(confirm('Start the exam timer for every cadet now?'))await changeStatus(id,true);}
  else if(action==='close-quiz'){if(confirm('Close this quiz? Cadets will not be able to submit afterward.'))await changeStatus(id,false);}
  else if(action==='copy-code'){try{await navigator.clipboard.writeText(el.dataset.code);el.textContent='Copied!';}catch{prompt('Copy this code:',el.dataset.code);}}
  else if(action==='results'){await showResults(id);}
  else if(action==='export-csv'){window.shipstructCSV?.();}
  else if(action==='resume-quiz'){await openQuiz(id);}
  else if(action==='answer'){picked[Number(el.dataset.question)]=Number(el.dataset.choice);const q=el.dataset.question;document.querySelectorAll(`[data-action="answer"][data-question="${q}"]`).forEach(x=>x.classList.toggle('selected',x.dataset.choice===el.dataset.choice));}
  else if(action==='submit-quiz'){await submitQuiz();}
});
bootstrap();
})();
