# Sign-in emails (forgotten password)

"Forgot your password?" on /login emails a 6-digit code (and a link), signs the
person in, then asks for a new password. Three settings in the Supabase
dashboard (project `jvzwbguwoafayxmdirnj`) decide whether that email arrives
and works; they are not in the code.

## 1. Custom SMTP (the one that matters)

Supabase's built-in mailer is for testing: it sends a handful of emails per
hour and only to addresses that are members of the Supabase organisation.
Anyone else (a Gmail or Outlook address outside the org) never gets the code.

Authentication → Emails → SMTP Settings → enable custom SMTP, e.g. Resend
(free tier, 3 000 emails/month): host `smtp.resend.com`, port 465, user
`resend`, password = a Resend API key, sender `Hembrain <noreply@your-domain>`
(the domain verified in Resend, with its SPF/DKIM records so Gmail doesn't
file it as spam). Then raise Authentication → Rate Limits → emails per hour.

## 2. Magic Link template: code + a link that works in the Gmail app

Authentication → Emails → Templates → **Magic Link**. The default only has a
PKCE link, which fails when opened in another browser than the one that asked
(the Gmail app's own browser, for instance). Use:

```html
<h2>Your Hembrain code</h2>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Type it in Hembrain, or
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/profile">sign in with this link</a>.</p>
<p>Valid for one hour. You can then choose a new password.</p>
```

`/auth/callback` verifies `token_hash` server-side, so the link works anywhere.

## 3. URLs

Authentication → URL Configuration: Site URL = `https://hembrain.vercel.app`,
Redirect URLs include `https://hembrain.vercel.app/**`.
