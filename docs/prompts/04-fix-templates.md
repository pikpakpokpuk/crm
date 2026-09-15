# Prompt: Fix Document Templates (upload + starter download are broken)

Paste this whole file as the task prompt for an implementation session.

## Status

The templates feature (upload a `.docx` template with `{placeholder}` tags,
generate filled offers/deviz/invoices per job) is almost entirely built —
[server/src/services/document.service.ts](server/src/services/document.service.ts),
[server/src/controllers/document.controller.ts](server/src/controllers/document.controller.ts),
[server/src/routes/document.routes.ts](server/src/routes/document.routes.ts), and
[client/src/pages/TemplatesPage.tsx](client/src/pages/TemplatesPage.tsx) all
exist and are wired up. But two specific paths are broken — this is a bug fix,
not new development.

## Bug 1: Template upload always 401s

[client/src/pages/TemplatesPage.tsx](client/src/pages/TemplatesPage.tsx)
`handleUpload()` does:

```ts
const res = await fetch('/api/documents', { method: 'POST', body: fd });
```

with no `Authorization` header. Every route in
[document.routes.ts](server/src/routes/document.routes.ts) sits behind
`router.use(authenticate)`, so this 401s every time — uploading a template
does not work today. It has to use raw `fetch` (not the `api` helper in
[client/src/lib/api.ts](client/src/lib/api.ts)) because it sends
`multipart/form-data`, and `api.post` always JSON-encodes.

Fix: read the token the same way `api.ts` does (`localStorage.getItem('token')`)
and add it as a Bearer header on this fetch call, same pattern already used
correctly in `JobDetailPage.tsx`'s `generateDoc()`:

```ts
const token = localStorage.getItem('token');
const res = await fetch('/api/documents', {
  method: 'POST',
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  body: fd,
});
```

## Bug 2: Starter template download always 401s

`downloadStarter()` in the same file does:

```ts
const downloadStarter = () => {
  window.open('/api/documents/starter', '_blank');
};
```

`window.open` can't attach an Authorization header, so this also 401s. Two
valid fixes — pick whichever is more consistent with the rest of the app once
you're in the code, but the second is simpler and matches Bug 1's fix:

- (a) Fetch it as a blob with the auth header (same pattern as `generateDoc`
  in `JobDetailPage.tsx`: fetch → blob → `URL.createObjectURL` → trigger a
  synthetic `<a download>` click → revoke the URL), or
- (b) Move `GET /documents/starter` above `router.use(authenticate)` in
  `document.routes.ts` — it's a generic blank template with no tenant data in
  it, so serving it unauthenticated is safe, and `window.open` keeps working
  as-is.

## Also verify while in there

- `multer`'s `diskStorage` in `document.routes.ts` writes to
  `../../uploads/templates` relative to the routes file. Confirm that
  directory exists (create it if missing, e.g. in `server/src/app.ts` startup
  or via a `fs.mkdirSync(..., { recursive: true })` in the routes file) —
  otherwise the *first* upload on a fresh checkout fails with an ENOENT even
  after Bug 1 is fixed.
- `deleteTemplate` in `TemplatesPage.tsx` already correctly uses the `api`
  helper (which does attach the auth header) — no change needed there.
- `generateDoc` in `JobDetailPage.tsx` already correctly attaches the auth
  header — no change needed there either. Use it as your reference for what
  "correct" looks like.

## Acceptance check

Do this as a real end-to-end pass, not just a read-through — this feature was
believed to work before and wasn't:

1. Fresh login, go to Templates page, download the starter template — must
   succeed (Bug 2).
2. Open it in Word, keep the placeholder tags, save, re-upload as a new
   template — must succeed (Bug 1) and appear in the "Saved Templates" list.
3. Go to a job's detail page, pick that template from the dropdown, click
   Generate — must download a filled `.docx` with the job's real data in
   place of every placeholder (this path was already working — confirm it
   still is).
4. Delete the uploaded template from the Templates page — must succeed and
   remove both the DB row and the file on disk.
