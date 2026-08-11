# Task attachments

Task attachments keep reference material private to people who can already read
the task. The implementation deliberately separates the immutable original from
optional derived thumbnail and preview assets, so compression never replaces a
user's source file.

## Enable it

1. Apply migrations `016_task_attachments.sql` through
   `023_delete_attachment_metadata_instead_of_soft_delete.sql` after migrations 005–015.
2. Keep the `task-attachments` bucket private. The migration configures its
   allowlist and 100 MB object limit.
3. Deploy the web application. Signed preview URLs expire after five minutes;
   they are generated only after task access has been checked by Storage RLS.

## Supported reference files

- Images: JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF
- Documents: PDF, DOCX, XLSX, PPTX
- Text: TXT, Markdown, CSV, JSON

The browser rejects unsupported files before transfer. Storage policies repeat
task authorization, so browser checks are never a security boundary.

## Derived previews

The initial deployment serves the original securely and is immediately usable.
For high-volume production, add a trusted worker subscribed to new
`task_attachments` rows. It should:

1. Verify magic bytes and scan the original.
2. Mark suspicious files `rejected`; never issue a preview URL.
3. Generate an EXIF-stripped 320 px thumbnail and 1600 px preview in AVIF,
   with WebP fallback.
4. Render Office documents into a sandboxed PDF preview; never execute or
   browser-render Office XML.
5. Write immutable derived paths, then mark the attachment `ready`.

Do not overwrite an object path: immutable content-addressed paths keep CDN
and browser caches correct. Originals should be retained until the attachment
is explicitly removed or a documented retention policy expires.

## Operational checks

- Alert on upload failures, stuck `processing` rows, rejected files, and
  signed URL failures.
- Test RLS with owner, list editor, list viewer, task-only collaborator, and
  signed-out users.
- Run malware scanning and archive-bomb checks in the processing worker.
- Adopt the TUS upload adapter for files larger than 6 MB before lifting the
  upload size limit above 100 MB. The repository boundary is designed for this
  replacement without changing the UI or storage schema.
