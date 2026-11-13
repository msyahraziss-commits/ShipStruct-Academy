import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFile,MAX_FILE_SIZE,filterNotes,canManage,escapeHTML,uploadCourseNote} from './notes-core.mjs';
const lecturer={id:'11111111-1111-4111-8111-111111111111',role:'lecturer'};
const pdf=()=>new File(['%PDF-1.4\nCourse notes test'],'Hull Notes.PDF',{type:'application/pdf'});
test('file limits, signatures and document types are checked before upload',async()=>{
  assert.equal((await inspectFile(pdf())).extension,'pdf');
  assert.equal((await inspectFile(new File([new Uint8Array([80,75,3,4,0])],'Slides.pptx'))).extension,'pptx');
  await assert.rejects(()=>inspectFile(new File(['%PDF-1.4'],'unsafe.html')),/Choose a PDF/);
  await assert.rejects(()=>inspectFile(new File(['<html>'],'renamed.pdf')),/does not match/);
  await assert.rejects(()=>inspectFile(new File([],'empty.pdf')),/empty/);
  await assert.rejects(()=>inspectFile({name:'large.pdf',size:MAX_FILE_SIZE+1}),/25 MB/);
});
test('cadets cannot manage notes; drafts are visible only to their approved owner',()=>{
  const rows=[{id:'one',lecturer_id:lecturer.id,published:true,module_id:2,title:'Hull notes',author_name:'Lecturer A'},
    {id:'two',lecturer_id:lecturer.id,published:false,module_id:null,title:'Draft revision'},
    {id:'three',lecturer_id:'other',published:false,module_id:4,title:'Someone else draft'}];
  const cadet={id:lecturer.id,role:'cadet'};
  assert(!canManage(cadet,rows[0]));assert(!canManage({...lecturer,id:'other'},rows[0]));
  assert.deepEqual(filterNotes(rows,{},cadet).map(n=>n.id),['one']);
  assert.deepEqual(filterNotes(rows,{mine:true},lecturer).map(n=>n.id),['one','two']);
  assert.deepEqual(filterNotes(rows,{moduleId:'general'},lecturer).map(n=>n.id),['two']);
  assert.deepEqual(filterNotes(rows,{query:'  HULL  ',moduleId:'2'},cadet).map(n=>n.id),['one']);
});
function fakeClient({uploadError,insertError,cleanupError}={}){
  const calls=[];let payload;
  const bucket={upload:async(path,file,options)=>{calls.push(['upload',path,options]);return {error:uploadError};},remove:async paths=>{calls.push(['cleanup',paths]);return {error:cleanupError};}};
  return {calls,get payload(){return payload;},storage:{from:()=>bucket},from:()=>({insert:value=>{payload=value;calls.push(['insert']);return {select:()=>({single:async()=>({error:insertError,data:{...value,author_name:'Lecturer A'}})})};}})};
}
const details={title:'Hull structures',description:'Revision material',moduleId:'2',published:true};
test('upload writes a unique owner path, correct MIME type and publication choice',async()=>{
  const client=fakeClient();const result=await uploadCourseNote(client,lecturer,pdf(),details);
  assert.equal(result.lecturer_id,lecturer.id);assert.equal(result.module_id,2);assert(result.published);
  assert.equal(result.storage_path,`${lecturer.id}/${result.id}/note.pdf`);
  assert.equal(client.calls[0][2].upsert,false);assert.equal(client.calls[0][2].contentType,'application/pdf');
});
test('failed metadata save cleans up the uploaded object',async()=>{
  const client=fakeClient({insertError:new Error('Metadata unavailable')});
  await assert.rejects(()=>uploadCourseNote(client,lecturer,pdf(),details),/Metadata unavailable/);
  assert.deepEqual(client.calls.map(c=>c[0]),['upload','insert','cleanup']);
});
test('failed file upload never inserts metadata or removes an unrelated object',async()=>{
  const client=fakeClient({uploadError:new Error('Upload failed')});
  await assert.rejects(()=>uploadCourseNote(client,lecturer,pdf(),details),/Upload failed/);
  assert.deepEqual(client.calls.map(c=>c[0]),['upload']);
});
test('unapproved roles and invalid module values cannot start an upload',async()=>{
  const client=fakeClient();
  await assert.rejects(()=>uploadCourseNote(client,{...lecturer,role:'cadet'},pdf(),details),/approved lecturer/);
  await assert.rejects(()=>uploadCourseNote(client,lecturer,pdf(),{...details,moduleId:'99'}),/valid course module/);
  assert.deepEqual(client.calls,[]);
});
test('untrusted document metadata is escaped for HTML display',()=>{
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
