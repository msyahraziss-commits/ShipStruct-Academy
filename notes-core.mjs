export const MODULES = ['General course notes','Ship Construction Fundamentals','Ship Structural Components','Framing & Arrangements','Hull Strength & Loading','Watertight Integrity','Stability Fundamentals','Bulk Carrier Construction','Tanker & Special Ship Types','Engine Room Structure','Surveys, Rules & Safety'];
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const BUCKET = 'shipstruct-course-notes';
const TYPES = {pdf:'application/pdf',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const formatSize = bytes => bytes < 1048576 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/1048576).toFixed(1)} MB`;
export const canManage = (actor,note) => actor?.role === 'lecturer' && actor.id === note.lecturer_id;
export function filterNotes(notes,{query='',moduleId='',mine=false},actor){
  const search=query.trim().toLocaleLowerCase();
  return notes.filter(note=>(note.published || canManage(actor,note)) &&
    (!mine || canManage(actor,note)) &&
    (moduleId==='' || (moduleId==='general' ? note.module_id===null : note.module_id===Number(moduleId))) &&
    (!search || [note.title,note.description,note.author_name,note.file_name].some(x=>String(x||'').toLocaleLowerCase().includes(search))));
}
export async function inspectFile(file){
  if(!file)throw new Error('Choose a course note file first.');
  const extension=String(file.name).split('.').at(-1).toLowerCase();
  if(!TYPES[extension])throw new Error('Choose a PDF, PowerPoint (.pptx), or Word (.docx) file.');
  if(!Number.isSafeInteger(file.size)||file.size<=0)throw new Error('The selected file is empty.');
  if(file.size>MAX_FILE_SIZE)throw new Error('Choose a file smaller than 25 MB.');
  const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
  const pdf=bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45;
  const office=bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4;
  if(extension==='pdf'?!pdf:!office)throw new Error('This file does not match its document type. Export it again and retry.');
  return {extension,mime:TYPES[extension]};
}
export async function uploadCourseNote(client,actor,file,details){
  if(actor?.role!=='lecturer'||!actor.id)throw new Error('An approved lecturer account is required to upload notes.');
  const title=String(details.title||'').trim(),description=String(details.description||'').trim();
  if(title.length<3||title.length>120)throw new Error('Use a title between 3 and 120 characters.');
  if(description.length>1500)throw new Error('Keep the description within 1,500 characters.');
  const moduleId=details.moduleId===''?null:Number(details.moduleId);
  if(moduleId!==null&&(!Number.isInteger(moduleId)||moduleId<1||moduleId>10))throw new Error('Choose a valid course module.');
  const spec=await inspectFile(file),id=crypto.randomUUID();
  const storagePath=`${actor.id}/${id}/note.${spec.extension}`;
  const bucket=client.storage.from(BUCKET);
  const upload=await bucket.upload(storagePath,file,{contentType:spec.mime,upsert:false});
  if(upload.error)throw upload.error;
  const payload={id,lecturer_id:actor.id,title,description,module_id:moduleId,published:details.published===true,
    storage_path:storagePath,file_name:String(file.name).slice(0,240),file_size:file.size,file_extension:spec.extension,mime_type:spec.mime};
  try{
    const result=await client.from('shipstruct_course_notes').insert(payload).select().single();
    if(result.error)throw result.error;
    return result.data;
  }catch(error){
    try{const cleanup=await bucket.remove([storagePath]);if(cleanup.error)error.cleanupFailed=true;}catch{error.cleanupFailed=true;}
    throw error;
  }
}
