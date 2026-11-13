import {MODULES,BUCKET,escapeHTML as esc,formatSize,canManage,filterNotes,inspectFile,uploadCourseNote} from './notes-core.mjs';

const content=document.getElementById('notes-content'),status=document.getElementById('notes-status');
const identity=document.getElementById('notes-identity'),preview=document.getElementById('note-preview'),edit=document.getElementById('note-edit');
const conf=window.SHIPSTRUCT_CONFIG||{};
let client,actor=null,notes=[],busy=false;
const filters={query:'',moduleId:'',mine:false};
const moduleOptions=(all=false)=>(all?'<option value="">All modules</option><option value="general">General course notes</option>':'<option value="">General course notes</option>')+MODULES.slice(1).map((name,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')} · ${esc(name)}</option>`).join('');
const notify=(message,type='')=>{status.innerHTML=message?`<div class="notice ${type}">${esc(message)}</div>`:'';};
function readableError(error){
  if(error?.cleanupFailed)return 'The note could not be saved. Please retry; your administrator may need to remove an incomplete upload.';
  if(error?.code==='42501'||/row.level security/i.test(error?.message||''))return 'This action needs an approved lecturer account and ownership of the note. Refresh your account status and try again.';
  return error?.message||'Unable to complete that action. Please try again.';
}
function setBusy(value){
  busy=value;
  document.querySelectorAll('[data-write],#upload-note button[type="submit"],#edit-form button[type="submit"],#notes-signout').forEach(button=>button.disabled=value);
}
function signedOut(){
  actor=null;notes=[];identity.textContent='';notify('');
  content.innerHTML='<section class="card note-signin"><div class="eyebrow">FOR SHIPSTRUCT COURSE MEMBERS</div><h2 style="margin-top:14px">Your course material starts here</h2><p>Sign in with your cadet or lecturer account to access shared course notes. Approved lecturers can upload and manage their documents.</p><a class="btn" href="classroom.html?next=notes">Sign in to course notes →</a></section>';
}
function libraryShell(){
  identity.innerHTML=`<span class="subtle">${esc(actor.name)} · ${esc(actor.role)}</span><button class="btn alt" id="notes-signout" type="button">Sign out</button>`;
  content.innerHTML=`<div class="notes-heading"><div><h2>Notes library</h2><p>Find the material shared for your course.</p></div>${actor.role==='lecturer'?'<button class="btn" type="button" data-action="show-upload" data-write>＋ Upload course notes</button>':''}</div>
    ${actor.role==='lecturer'?`<section class="card upload-panel" id="upload-panel" hidden aria-labelledby="upload-title"><h2 id="upload-title">Share a course note</h2><p>Add a clear title and choose the module so cadets can find the right material.</p><form id="upload-note"><div class="upload-fields"><label class="field"><span>Note title</span><input name="title" required minlength="3" maxlength="120" placeholder="e.g. Module 2 — Hull structural components"></label><label class="field"><span>Course module</span><select name="module">${moduleOptions()}</select></label><label class="field wide"><span>Description (optional)</span><textarea name="description" maxlength="1500" placeholder="What does this note cover? Any preparation for the next class?"></textarea></label><div class="field wide file-drop"><label for="note-file"><strong>Choose your document</strong></label><input id="note-file" name="file" type="file" required accept=".pdf,.pptx,.docx"><small>PDF, PowerPoint (.pptx), or Word (.docx) · up to 25 MB</small><small id="selected-file"></small></div></div><label class="publish-choice"><input type="checkbox" name="published" checked> Make available to cadets immediately</label><div class="toolbar"><button class="btn" type="submit">Upload note</button><button class="btn alt" type="button" data-action="cancel-upload">Cancel</button></div><p class="subtle">Uncheck the box to save a private draft. You can publish it later.</p></form></section>`:''}
    <div class="notes-filters"><label class="field"><span>Search course notes</span><input type="search" id="note-search" placeholder="Search title, lecturer or file name…"></label><label class="field"><span>Filter by module</span><select id="note-module">${moduleOptions(true)}</select></label><button class="btn alt" type="button" data-action="refresh">Refresh</button></div>
    ${actor.role==='lecturer'?'<label class="mine-choice"><input type="checkbox" id="only-mine"> My uploads only (includes drafts)</label>':''}
    <p id="notes-count" class="notes-count" aria-live="polite"></p><div id="notes-grid" class="notes-grid"><div class="card">Loading your course library…</div></div>`;
  if(actor.role!=='lecturer')filters.mine=false;
  document.getElementById('note-search').value=filters.query;
  document.getElementById('note-module').value=filters.moduleId;
  if(document.getElementById('only-mine'))document.getElementById('only-mine').checked=filters.mine;
  document.getElementById('notes-signout').onclick=async()=>{if(busy)return;const {error}=await client.auth.signOut();if(error)notify(readableError(error),'error');else signedOut();};
  document.getElementById('note-search').oninput=e=>{filters.query=e.target.value;drawNotes();};
  document.getElementById('note-module').onchange=e=>{filters.moduleId=e.target.value;drawNotes();};
  document.getElementById('only-mine')?.addEventListener('change',e=>{filters.mine=e.target.checked;drawNotes();});
  const upload=document.getElementById('upload-note');
  if(upload){
    upload.onsubmit=submitUpload;
    document.getElementById('note-file').onchange=async e=>{
      const label=document.getElementById('selected-file'),file=e.target.files[0];label.textContent='';if(!file)return;
      try{await inspectFile(file);label.textContent=`${file.name} · ${formatSize(file.size)}`;}catch(error){notify(readableError(error),'error');e.target.value='';}
    };
  }
}
function drawNotes(){
  const grid=document.getElementById('notes-grid');if(!grid)return;
  const rows=filterNotes(notes,filters,actor);
  document.getElementById('notes-count').textContent=`${rows.length} ${rows.length===1?'document':'documents'}${filters.mine?' in your uploads':''}`;
  grid.className=rows.length?'notes-grid':'';
  grid.innerHTML=rows.length?rows.map(note=>`<article class="note-card"><div class="file-label"><span class="file-badge ${esc(note.file_extension)}">${esc(note.file_extension.toUpperCase())}</span><span>${formatSize(note.file_size)}</span>${!note.published?'<span class="draft-badge">Private draft</span>':''}</div><h3>${esc(note.title)}</h3><div class="note-module">${esc(MODULES[note.module_id||0])}</div>${note.description?`<p class="note-description">${esc(note.description)}</p>`:'<div style="height:15px"></div>'}<div class="note-meta">${esc(note.author_name)} · ${new Date(note.created_at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}<br>${esc(note.file_name)}</div><div class="toolbar note-actions">${note.file_extension==='pdf'?`<button class="btn" type="button" data-action="preview" data-id="${esc(note.id)}">View PDF</button>`:''}<button class="btn alt" type="button" data-action="download" data-id="${esc(note.id)}">Download ↓</button>${canManage(actor,note)?`<button class="btn alt manage" type="button" data-action="edit" data-write data-id="${esc(note.id)}">Edit · ${note.published?'Published':'Draft'}</button>`:''}</div></article>`).join(''):`<div class="empty-notes"><div class="empty-symbol" aria-hidden="true">▤</div><h3>${notes.length?'No matching notes':'Your course library is ready'}</h3><p>${notes.length?'Try another search or module filter.':actor.role==='lecturer'?'Upload your first course note to share it with cadets.':'Your lecturers have not published any notes yet. Check back after your next class.'}</p></div>`;
  setBusy(busy);
}
async function loadNotes(){
  const all=[];let offset=0;
  try{
    while(true){
      const {data,error}=await client.from('shipstruct_course_notes').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+499);
      if(error)throw error;
      all.push(...(data||[]));if(!data||data.length<500)break;offset+=500;
    }
    notes=all;drawNotes();
  }catch(error){
    if(['PGRST205','42P01'].includes(error.code)){
      document.getElementById('upload-panel')?.setAttribute('hidden','');
      content.innerHTML='<section class="setup-note"><h2>Course notes are being prepared</h2><p>Your academy is activating the shared document library. Please check back shortly.</p><a class="btn alt" href="classroom.html">Return to Classroom</a></section>';
    }else{notify(readableError(error),'error');document.getElementById('notes-grid').innerHTML='<div class="card">The library could not load. Choose Refresh to try again.</div>';}
  }
}
async function loadIdentity(){
  const {data:session,error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;
  if(!session.session){signedOut();return;}
  const {data,error}=await client.auth.getUser();if(error)throw error;
  if(!data.user){signedOut();return;}
  const result=await client.from('shipstruct_profiles').select('id,full_name,role').eq('id',data.user.id).single();
  if(result.error)throw result.error;
  actor={id:data.user.id,role:result.data.role,name:result.data.full_name||'Course member'};
  libraryShell();await loadNotes();
}
async function submitUpload(event){
  event.preventDefault();if(busy)return;
  const form=event.target,data=new FormData(form),submit=form.querySelector('button[type="submit"]');setBusy(true);submit.textContent='Uploading…';notify('Uploading your course note. Please keep this page open.');
  try{
    const note=await uploadCourseNote(client,actor,document.getElementById('note-file').files[0],{title:data.get('title'),description:data.get('description'),moduleId:data.get('module'),published:data.get('published')==='on'});
    notes.unshift(note);form.reset();document.getElementById('selected-file').textContent='';document.getElementById('upload-panel').hidden=true;
    filters.query='';filters.moduleId='';filters.mine=true;document.getElementById('note-search').value='';document.getElementById('note-module').value='';document.getElementById('only-mine').checked=true;
    drawNotes();notify(note.published?'Note published. Cadets can now view or download it.':'Draft saved. Only you can see it until you publish it.');
  }catch(error){notify(readableError(error),'error');}finally{setBusy(false);submit.textContent='Upload note';}
}
async function openDocument(note,download){
  const {data,error}=await client.storage.from(BUCKET).createSignedUrl(note.storage_path,300,download?{download:note.file_name}:{});
  if(error)throw error;
  if(download){const link=document.createElement('a');link.href=data.signedUrl;link.download=note.file_name;link.rel='noopener';document.body.append(link);link.click();link.remove();}
  else{document.getElementById('preview-title').textContent=note.title;document.getElementById('preview-frame').src=data.signedUrl;preview.showModal();}
}
function editNote(note){
  if(!canManage(actor,note))return;
  const form=document.getElementById('edit-form');form.elements.id.value=note.id;form.elements.title.value=note.title;form.elements.description.value=note.description;
  form.elements.module.innerHTML=moduleOptions();form.elements.module.value=note.module_id??'';form.elements.published.checked=note.published;document.getElementById('edit-error').textContent='';edit.showModal();
}
document.getElementById('edit-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const form=event.target,id=form.elements.id.value,note=notes.find(n=>n.id===id);if(!note||!canManage(actor,note))return;
  setBusy(true);
  try{
    const {data,error}=await client.from('shipstruct_course_notes').update({title:form.elements.title.value.trim(),description:form.elements.description.value.trim(),module_id:form.elements.module.value===''?null:Number(form.elements.module.value),published:form.elements.published.checked}).eq('id',id).eq('lecturer_id',actor.id).select().single();
    if(error)throw error;notes=notes.map(n=>n.id===id?data:n);edit.close();drawNotes();notify('Course note updated.');
  }catch(error){document.getElementById('edit-error').textContent=readableError(error);}finally{setBusy(false);}
};
document.getElementById('cancel-edit').onclick=()=>edit.close();
document.getElementById('close-preview').onclick=()=>preview.close();
preview.addEventListener('close',()=>{document.getElementById('preview-frame').src='about:blank';});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,note=notes.find(n=>n.id===button.dataset.id);
  if(action==='show-upload'){document.getElementById('upload-panel').hidden=false;document.querySelector('#upload-note input[name="title"]').focus();return;}
  if(action==='cancel-upload'){if(!busy)document.getElementById('upload-panel').hidden=true;return;}
  if(action==='edit'){if(!busy&&note)editNote(note);return;}
  if(action==='refresh'){if(!busy){notify('');await loadIdentity();}return;}
  if((action==='preview'||action==='download')&&note){button.disabled=true;try{await openDocument(note,action==='download');}catch(error){notify(readableError(error),'error');}finally{button.disabled=false;}}
});
async function start(){
  try{
    if(!/^https:\/\/[^\s]+\.supabase\.co\/?$/.test(conf.supabaseUrl||'')||!conf.supabasePublishableKey)throw new Error('The course account connection is not configured. Please contact the academy administrator.');
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');client=createClient(conf.supabaseUrl,conf.supabasePublishableKey);
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){if(preview.open)preview.close();if(edit.open)edit.close();signedOut();}});
    await loadIdentity();
  }catch(error){notify(readableError(error),'error');content.innerHTML='<section class="card note-signin"><h2>Unable to open course notes</h2><p>Please check your connection and try again.</p><button class="btn alt" type="button" id="retry-notes">Retry</button></section>';document.getElementById('retry-notes').onclick=()=>location.reload();}
}
start();
