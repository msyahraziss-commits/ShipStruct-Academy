# ShipStruct Course Notes

The app now has a Course Notes library linked from the dashboard and Classroom. Approved lecturers can upload PDF, PPTX and DOCX documents up to 25 MB, assign a module, save private drafts and publish notes for signed-in cadets. PDF files can be previewed; all supported documents can be downloaded.

## One-time storage activation

1. Open the existing ShipStruct Supabase project: `tkdwnrzihjqgnygukofs`.
2. In SQL Editor, run the complete `course_notes_setup.sql` file.
3. Sign in to the app as an approved lecturer, open Course Notes, and choose Upload course notes.

The migration adds `shipstruct_course_notes`, a private `shipstruct-course-notes` bucket, and ownership/access policies. It does not replace the Classroom schema or change existing quiz records. Use the existing project configuration; no secret key belongs in the browser.

## Validation

Run `node --test notes-core.test.mjs` for file validation, role checks, filters and failed-upload cleanup. The migration is PostgreSQL syntax checked. Local UI checks cover lecturer upload, draft editing, cadet visibility, PDF preview and download. Real shared uploads require the migration to be applied to Supabase.
