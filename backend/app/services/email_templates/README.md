# Email Templates

Backend-owned transactional email templates live here so provider code can send
the same content through Resend or a future provider.

## `admin_invite`

Use `admin_invite.html` as the primary invite email body and
`admin_invite.txt` as the plain-text fallback.

Required render variables:

- `invite_url` - absolute `{SITE_URL}/set-password?invite=<token>` link
- `recipient_email` - lowercased invitee email
- `role_label` - human-readable role, such as `Admin` or `Research Assistant`
- `lab_name` - lab name stored in Supabase `app_metadata.lab_name`
- `expires_at` - RA-facing expiry text, including timezone when available
- `site_name` - product name, default `UBC Psychology Lab Research Platform`
- `support_email` - contact email for access questions; use `ADMIN_EMAIL_FROM`
  when no separate support address is configured

Suggested subject:

`You're invited to {{site_name}}`

Do not send these files without rendering placeholders. Raw invite tokens should
only appear inside `invite_url` and must not be logged or persisted.
