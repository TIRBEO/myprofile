# Database schema for `apps/myprofile`

Every table the settings app needs, designed from the data the screens actually
hold today in `localStorage`. Written before any backend exists, so it is a
spec rather than a migration: nothing here assumes the old `supabase/migrations/`
or the old Prisma schema.

Target engine: **Postgres** (Supabase-shaped — `uuid` primary keys,
`created_at`/`updated_at` on every row, RLS on every user-owned table).
Swap the type names for another engine later; the shapes and constraints carry.

---

## 0. Ground rules

**We never store a password.** Not hashed, not encrypted, not "temporarily".
The password screens in this app (`security`, `confirm-deletion`) are *verifying*
a secret the account provider already holds. So there is no `password` column
anywhere in this document, and the check is a call out to the auth provider.
If we ever self-host auth, the hash lives in the auth layer, never in a table
this app can read.

Other rules that shape everything below:

| Rule | Why |
| --- | --- |
| `id uuid default gen_random_uuid()` on every table | The app mints ids client-side today (`crypto.randomUUID`). Server-side ids let two devices insert the same logical row without colliding. |
| `account_id` on every user-owned table, not `user_id` | One human can hold several accounts (personal + work, the app supports appeal/reactivation flows on the same login). Naming it `account_id` keeps the subject unambiguous. |
| `created_at timestamptz not null default now()` | Timestamps are instants, never local strings. Pokhara/Kathmandu/Lagos all appear in this app's copy. |
| `updated_at` only on tables a user edits in place | Preferences and profile rows get edited; event rows are append-only and must never change. |
| Append-only for anything the user reads as "history" | `login_events`, `security_events`, `change_log`, `session_events`, `disconnect_events`. No `UPDATE` grant, no soft delete. |
| Every enum is a real Postgres `enum` type | The UI switch statements and the DB must not be able to drift. Listed in §18. |
| `jsonb` only for genuinely opaque payloads | `export_archives.manifest`, `support_requests.origin`. Never for fields a screen filters or sorts on. |

**Naming.** Tables singular-prefixed by domain (`profile_`, `device_`, `two_factor_`),
columns `snake_case`, indexes `_<table>_<columns>_idx`.

---

## 1. Accounts and identity

The subject of every other row. Deliberately small — the auth provider owns
credentials, this owns *what the app displays and can be held to*.

### `accounts`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `auth_subject` | text unique not null | opaque id from the auth provider; the only thing that links a DB row to a login session |
| `username` | citext unique not null | `@handle`, lowercase-normalised, 2–30 chars, `[a-z0-9._]` |
| `display_name` | text not null | |
| `email` | citext | nullable — an account can exist with phone only; see `account_emails` |
| `phone` | text | nullable, E.164 (`^\+[0-9]{8,15}$`) |
| `state` | `account_state` not null default `active` | `active \| locked \| restricted \| deactivated \| pending_deletion` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

One row per account, and the row the lock screens (`restricted`, `deactivated`,
`deletion-pending`) decide the route on. `state` is derived-and-cached; the
authoritative versions live in §11 and §12.

### `account_emails`

A person can attach several addresses but only one receives. Keeps the
personal-details screen's single `email` field honest without losing history.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK→accounts | |
| `email` | citext not null | unique across the table |
| `verified_at` | timestamptz | null until proven |
| `primary` | boolean not null default false | exactly one per account, partial unique index |
| `created_at` | timestamptz | |

Partial unique: `create unique index account_emails_primary_idx on account_emails (account_id) where "primary";`

### `account_phones`

Same idea, same shape: `id, account_id, phone text not null (unique), verified_at, primary boolean, created_at`.

### `recovery_emails`

Backs the `tirbeo:recovery-email` store. Separate from `account_emails` because
it is not a login address and must never be offered as one.

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | one per account |
| `email` | citext not null | |
| `verified_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## 2. Profile

Split from `accounts` because it is the largest, most frequently edited row and
it is *shown to other people* — a different visibility rule from the security
screens.

### `profiles`

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | strictly 1:1 |
| `name` | text | the display name, editable separately from `accounts.display_name` (that one is the legal-ish anchor) |
| `bio` | text | ≤ 200 chars, checked in the app |
| `pronouns` | text | |
| `gender` | text | free text; the app offers choices but stores a string |
| `location` | text | label, not a geo row |
| `date_of_birth` | date | |
| `photo_url` | text | null → render the deterministic avatar from `username` |
| `banner_url` | text | |
| `followers_count` | bigint not null default 0 | denormalised; the app only displays it |
| `following_count` | bigint not null default 0 | ditto |
| `updated_at` | timestamptz | |

Follow *relationships* are not in this app's screens, so no `follows` table —
only the two counters the hub page renders. Add `social_accounts` later if the
"edit profile" links section grows past the single `website` field.

### `profile_field_validations`

The edit-profile screen blocks Save until a required set is present
(`name`, `username`, `location`). Server-side, that is a policy, not a per-row
flag — so this table is only needed if validation becomes per-field and auditable.
**Marked optional; skip in the first pass.** The rule belongs in a trigger or in
the API: reject the write, return which fields were missing. The app already
renders per-field notes.

### `personal_details`

The `tirbeo:personal-details` record: contact + work + skills.

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | 1:1 |
| `website` | text | URL, validated |
| `job_role` | text | |
| `job_company` | text | |
| `job_place` | text | |
| `job_started_on` | date | the store keeps a year-month string; store a real date |
| `updated_at` | timestamptz | |

`email` and `phone` from the same screen are **not** duplicated here — they are
`accounts.email` / `accounts.phone`, written through §1.

### `skills`

The screen caps at 8 (`MAX_SKILLS`). A real table so the cap is a constraint the
DB can enforce, and so "Mentor · React" is searchable someday.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `label` | text not null | |
| `position` | smallint not null | the screen lets the user reorder |
| `created_at` | timestamptz | |

`unique (account_id, label)`, `unique (account_id, position)`, and a check or
trigger enforcing `count <= 8 per account`.

### `places`

`locations.ts` ships a static name→coordinate table used to label the "Lagos",
"Pokhara" strings in device and login rows. Reference data, seeded, read-only
to users.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | text unique | |
| `country` | text | |
| `lat` | double precision | |
| `lng` | double precision | |

---

## 3. Devices, sessions, sign-in

Two different things the app shows, and the schema must not confuse them:
a **device** is a recognised machine (long-lived, the user can rename or sign it
out); a **session** is one sign-in on that machine (short-lived, revocable).

### `devices`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `kind` | `device_kind` not null | `computer \| phone \| tablet` |
| `name` | text not null | user-facing label, editable |
| `os` | text | |
| `browser` | text | |
| `location` | text | label resolved from IP via `places` |
| `ip` | inet | last seen |
| `signed_in_at` | timestamptz not null | first time this device appeared |
| `last_active_at` | timestamptz not null | |
| `sign_in_count` | integer not null default 1 | the store's `logins: number[]` — length only |
| `current` | not stored | derived from the live session, §"session" below |
| `created_at`, `updated_at` | timestamptz | |

No `logins` array: the individual sign-ins are rows in `login_events`, and
storing them twice guarantees they disagree. The app's `logins: number[]`
becomes `count(*)` over `login_events.device_id`.

### `sessions`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | the session token is a hash of this id, never the id |
| `account_id` | uuid FK | |
| `device_id` | uuid FK→devices | |
| `started_at` | timestamptz not null | |
| `last_seen_at` | timestamptz not null | |
| `expires_at` | timestamptz not null | |
| `revoked_at` | timestamptz | null = live |
| `revoked_by` | uuid FK→accounts | null = system/expiry |
| `revoke_reason` | `revoke_reason` | `signed_out \| signed_out_all \| password_changed \| two_factor_off \| admin \| expired` |

`sign_out_devices` (`/settings/devices/sign-out`) and "sign out of everywhere"
both become `update sessions set revoked_at = now() …` plus one
`session_events` row each.

### `session_events`

Append-only. This is the `/settings/devices` timeline (the store's
`tirbeo:devices:log`).

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `device_id` | uuid FK null | null for account-wide actions |
| `kind` | `session_event_kind` | `signed-out \| signed-out-all` |
| `label` | text | the sentence the row shows |
| `at` | timestamptz not null | |

### `login_events`

`/settings/login-activity` and its detail page.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `at` | timestamptz not null | |
| `kind` | `login_event_kind` | `signin \| signout \| failed \| password \| two-factor \| passkey` |
| `device_id` | uuid FK null | |
| `device_label` | text | snapshot — the row must read the same in five years |
| `location` | text | snapshot |
| `ip` | inet | |
| `method` | text | `password \| passkey \| totp \| backup-code` |
| `current_session` | boolean | derived at read, not stored |
| `suspicious` | boolean not null default false | |
| `created_at` | timestamptz | |

Snapshot columns are intentional: a login row describes the world as it looked
at 03:12 on a Tuesday, and re-joining to a mutable `devices.name` would rewrite
history when the user renames a laptop.

### `login_event_reviews`

The "This was me / This wasn't me" answer. Separate table because a review is a
*second* fact about an event, and the event row must stay append-only.

| column | type | notes |
| --- | --- | --- |
| `login_event_id` | uuid PK/FK | one answer per event |
| `account_id` | uuid FK | denormalised for RLS |
| `review` | `login_review` | `me \| not-me` |
| `reviewed_at` | timestamptz not null | |

---

## 4. Security events and the change log

Two streams the app shows on different pages; keep them separate.

### `security_events`

Anything that could mean an account is compromised: password changed, 2FA
toggled, passkey added, recovery email changed, a restriction applied.
Same columns as `login_events` plus `type text` and `detail jsonb`.
Append-only. Feeds the alerts in `two_factor_prefs.alert_suspicious`.

### `change_log`

`/settings/activity-log` — "you changed your bio from X to Y on Chrome in Lagos".
This is a **diff audit of the user's own writes**, so it is generated by the API
layer on every successful update to a tracked table, not by the client.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `at` | timestamptz not null | |
| `kind` | `change_kind` | the store's `ChangeKind`: profile, security, device, payment-free subsets |
| `field` | text | the column that changed |
| `from_value` | text | null for a create |
| `to_value` | text | null for a delete |
| `device_id` | uuid FK null | |
| `device_label` | text | snapshot |
| `location` | text | snapshot |
| `ip` | inet | |
| `created_at` | timestamptz | |

### `change_log_responses`

The `youSaid: recognised | not-me` + `youSaidAt` pair on a change row.
Same reasoning as `login_event_reviews`: one-to-one side table, keeps `change_log`
immutable.

| column | type | notes |
| --- | --- | --- |
| `change_log_id` | uuid PK/FK | |
| `account_id` | uuid FK | |
| `response` | `change_response` | `recognised \| not-me` |
| `responded_at` | timestamptz not null | |

Index `(account_id, at desc)` on both log tables — every read in the app is a
reverse-chronological page.

---

## 5. Two-factor, passkeys, recovery

### `two_factor`

One row per account; the secret is server-held and never sent to the client
after setup (the app's `tirbeo:two-factor-secret` in `localStorage` is the bug
this fixes).

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | |
| `secret` | bytea not null | encrypted with a server-side key; never selected by a read endpoint |
| `issuer` | text not null default 'Tirbeo' | |
| `enabled_at` | timestamptz | null = enrolled but not yet confirmed |
| `require_for_actions` | boolean not null default false | step-up on sensitive writes |
| `alert_suspicious` | boolean not null default false | |
| `created_at`, `updated_at` | timestamptz | |

The three booleans here are the `two-factor` page's Prefs; the app treats them
as one screen, so one row.

### `backup_codes`

The store's `CodeSet` (a set of codes plus a `seen` list) becomes rows, because
"which code was used, when" is exactly the thing you need after an incident.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `code_hash` | text not null | the code itself is single-use and short; hash it, never store plaintext |
| `code_set_id` | uuid not null | groups the codes minted in one click of "Regenerate" |
| `created_at` | timestamptz not null | the set's date |
| `used_at` | timestamptz | null = unused |
| `used_for` | `login_event_kind` | |

"The set has been seen" (the `seen` flag that drives the 'save these' warning) is
one row per `code_set_id` in `backup_code_sets`.

### `backup_code_sets`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `created_at` | timestamptz not null | |
| `acknowledged_at` | timestamptz | null → show the "you haven't saved these" banner |
| `revoked_at` | timestamptz | set when regenerated |

### `passkeys`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text not null | user label ("iPhone 15") |
| `credential_id` | bytea unique not null | the WebAuthn `rawId` |
| `public_key` | bytea not null | **no private key, ever** — the platform authenticator holds it |
| `algorithm` | text not null | `-7` ES256, `-257` RS256 |
| `counter` | bigint not null | signature counter, for clone detection |
| `transports` | text[] | `["internal","hybrid"]` |
| `device_label` | text | where it was created |
| `created_at` | timestamptz | |
| `last_used_at` | timestamptz | |
| `revoked_at` | timestamptz | soft delete: a removed passkey must stay in the audit trail |

### `auth_rate_limits`

Replaces `tirbeo:backup-codes:rate` and `tirbeo:download-requests:rate`.
Client-side rate limiting is not rate limiting — the browser is attacker-
controlled. One table for every throttle.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK null | null for IP-scoped buckets (login attempts) |
| `ip` | inet null | |
| `action` | text not null | `backup-code-verify \| data-export-request \| support-request \| sign-in` |
| `window_start` | timestamptz not null | |
| `count` | integer not null | |
| `blocked_until` | timestamptz | |

`unique (action, account_id, window_start)`, and `unique (action, ip, window_start)`.

---

## 6. Connected apps

### `oauth_providers`

The catalogue the `connected-apps` page renders from (`Provider`: name, access
level, tagline, what you lose, scopes). Seeded reference data, admin-edited,
readable by anyone.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `slug` | text unique | |
| `name` | text | |
| `tagline` | text | |
| `access_summary` | text | the store's `access` ("Read your profile and activity") |
| `loss_summary` | text | what stops working if you disconnect |
| `scopes` | text[] | |
| `logo_url` | text | |

### `connected_apps`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `provider_id` | uuid FK→oauth_providers | |
| `external_account` | text | "you@gmail.com", masked at the API |
| `access_summary` | text | snapshot at consent time |
| `scopes` | text[] | snapshot at consent time |
| `granted_token_id` | uuid | pointer to the token store, never the token |
| `connected_at` | timestamptz not null | |
| `last_used_at` | timestamptz | |
| `revoked_at` | timestamptz | |

Snapshotting `access_summary`/`scopes` matters: the disconnect dialog says what
*that consent* gave, and the provider's default scope list can change underneath.

### `disconnect_events`

Append-only. Backs `tirbeo:connected-apps:history`, which the app uses to answer
"when did I lose this?"

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `provider_id` | uuid FK | |
| `provider_name` | text | snapshot |
| `at` | timestamptz not null | |

---

## 7. Account status, restrictions, appeals

The most consequential screens in the app — they decide which page you can even
reach. Server-authoritative, and the user must not be able to write to them.

### `status_sections`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `kind` | text | `payment \| content \| sign-in \| …` (the store's section ids) |
| `title` | text | |
| `summary` | text | |
| `severity` | `section_severity` | `ok \| warning \| action` |
| `opened_at` | timestamptz | |
| `closed_at` | timestamptz | null = still open |

### `status_items`

One guideline breach inside a section (`StatusItem`).

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `section_id` | uuid FK | |
| `account_id` | uuid FK | denormalised for RLS |
| `title` | text | |
| `detail` | text | the store's `sub` |
| `guideline` | text | which rule, linked |
| `guideline_href` | text | |
| `at` | timestamptz not null | |
| `appealable` | boolean not null default false | |
| `required_action` | text | the store's `ask` |
| `resolved_at` | timestamptz | |

RLS: **select-only for the owner**. No insert, no update, no delete for the
`authenticated` role at all. These rows come from moderation/review systems.

### `appeals`

The `tirbeo:account-status:appeals` store (`{id, at, note}`) becomes a real
thread, because an appeal is a support conversation with a decision.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `item_id` | uuid FK→status_items | |
| `note` | text not null | the user's message |
| `submitted_at` | timestamptz not null | |
| `status` | `appeal_status` | `submitted \| in-review \| upheld \| reversed` |
| `decided_at` | timestamptz | |
| `decision_note` | text | staff reply |

### `account_requests`

One table for the three lifecycle requests the app files — deactivation,
deletion, appeal — because they share a shape and share the history page
(`/settings/account-status/history`).

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `kind` | `request_kind` | `deactivation \| deletion \| appeal` |
| `at` | timestamptz not null | filed |
| `closed_at` | timestamptz | |
| `outcome` | `request_outcome` | `open \| restored \| reversed \| reviewed` |
| `detail` | text | the deactivation reason, etc. |

### `account_locks`

The server answer to `tirbeo:account-status:skipped`. A lock is *not* skippable,
so the client's "not now" list must not exist as truth — it can only be a UI
dismissal of a `skippable` lock.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `kind` | `lock_kind` | `deletion \| deactivated \| restriction` |
| `title` | text | |
| `detail` | text | the store's `sub` |
| `href` | text | which screen explains it |
| `skippable` | boolean not null | drives "not now" vs a hard wall |
| `applied_at` | timestamptz not null | |
| `lifted_at` | timestamptz | |

Partial index `where lifted_at is null` — every page load asks "am I locked?".

### `welcome_back_events`

`tirbeo:welcome-back` (`reactivated | deletion-cancelled`) — a one-shot
interstitial, so it is an event, not a flag, and the API can prove it has already
been shown.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `kind` | `welcome_kind` | `reactivated \| deletion-cancelled` |
| `at` | timestamptz not null | |
| `from_at` | timestamptz | when the account went quiet |
| `shown_at` | timestamptz | null until rendered |

---

## 8. Deactivation and deletion

The schedules, as distinct from the requests in §7: a request is "I asked", the
plan is "here is the date we will do it, and the countdown you see".

### `deactivation_plans`

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | |
| `requested_at` | timestamptz not null | |
| `reason` | text | |
| `effective_at` | timestamptz not null | |
| `restored_at` | timestamptz | null = still scheduled |

### `deletion_plans`

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | |
| `scheduled_at` | timestamptz not null | the user asked |
| `final_at` | timestamptz not null | hard-delete date, the countdown target on `/settings/deletion-pending` |
| `cancelled_at` | timestamptz | null = pending |
| `cancelled_reason` | text | |
| `completed_at` | timestamptz | set by the purge job |

`confirm-deletion` is the re-auth gate before this row is written; it creates no
table of its own.

---

## 9. Data export

### `export_archives`

`/settings/download-data` and `/settings/download-data/[id]`.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `format` | `archive_format` | `json \| html` |
| `scope` | `archive_scope` | `everything \| profile` |
| `requested_at` | timestamptz not null | |
| `status` | `archive_status` | `queued \| building \| ready \| failed \| expired` |
| `ready_at` | timestamptz | the store's `savedAt` |
| `expires_at` | timestamptz | we delete the file, not the row |
| `object_key` | text | storage locator, not a public URL |
| `size_bytes` | bigint | |
| `manifest` | jsonb | which tables/groups were included, and their row counts |
| `error` | text | shown on the detail page when it failed |

The `manifest` is the honest part: the detail page can say *what* the user is
downloading rather than guessing, and the export groups map 1:1 onto §1–§9.
Note `tirbeo:visibility` and `tirbeo:mentions` appear only in the export group
list and have no owning screen — they are **not** given tables; drop them from
the manifest (see §19).

---

## 10. Content activity

`/settings/your-activity` and `/settings/recently-deleted`. Both are about things
the user posts, which this app does not create — it reports and retracts.

### `activity_daily_totals`

`DayMinutes` (`{at, minutes}`) and the `Activity` aggregates (`key, label, color,
share, swing`) are two views of the same series, so store the series and derive
the rest.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `day` | date not null | |
| `metric` | text not null | `minutes`, or one row per activity key |
| `value` | numeric not null | |
| `created_at` | timestamptz | |

`unique (account_id, day, metric)`. The chart's `share` and `swing` are
arithmetic over these rows, never columns — stored derived values go stale and
then get trusted.

### `deleted_items`

The trash the "Recently deleted" page restores from. Soft delete with a real
expiry, because the page's promise is "gone in 30 days".

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `kind` | text | post, comment, story… |
| `label` | text | the preview text |
| `origin_id` | uuid | the row this used to be |
| `deleted_at` | timestamptz not null | |
| `purge_at` | timestamptz not null | `deleted_at + 30 days` |
| `restored_at` | timestamptz | |
| `payload` | jsonb | what to reinsert on restore |

---

## 11. Support and help content

### `support_requests`

`/settings/help/support` (`{id, at, topic, message, origin}`).

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `topic` | text not null | |
| `message` | text not null | |
| `origin_kind` | `origin_kind` | `article \| policy` |
| `origin_slug` | text | the "Report a problem with this page" handoff |
| `origin_title` | text | snapshot |
| `at` | timestamptz not null | |
| `status` | `support_status` | `open \| answered \| closed` |

Subject is snapshot-on-submit for the same reason login rows are: the article can
be retitled or unpublished, and the ticket must still make sense.

### `docs_articles` / `policies`

The help centre and privacy/security policy bodies (`help-policies.ts`'s
`{slug, title, sub, keywords, description, lines[]}`). These are **content, not
user data** — a table so the landing/marketing side and the app can share one
source, and so the slug→title mismatch (`Keeping your sign-in yours` →
`/settings/help/sign-in`) stops being a hand-maintained coincidence.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `kind` | `content_kind` | `article \| policy` |
| `slug` | text unique per `kind` | the URL segment |
| `title` | text | |
| `summary` | text | the store's `sub` |
| `description` | text | meta description |
| `keywords` | text[] | search |
| `body` | jsonb | the `lines[]` array — blocks, not markdown, so the renderer stays dumb |
| `published_at` | timestamptz | |
| `updated_at` | timestamptz | |

Read = public. Write = admin role only, no `authenticated` insert.

### `content_votes`

`tirbeo:docs-helpful`: one yes/no per reader per article, with the article
attributed to a page so the same document can be voted from help and policy
surfaces.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `content_id` | uuid FK→docs_articles | |
| `vote` | `helpful_vote` | `yes \| no` |
| `created_at`, `updated_at` | timestamptz | |

`unique (account_id, content_id)` — changing your mind updates, it does not add a
second vote.

---

## 12. Preferences

Booleans and enums keyed per account, all in narrow tables rather than one
`jsonb` blob — a blob cannot be partially updated under RLS without letting the
client rewrite settings another screen owns.

### `pref_theme`

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | |
| `theme_id` | text not null | the `ThemeDef` id: `light \| dark \| system \| …` |
| `accent` | text | null → app default |
| `updated_at` | timestamptz | |

### `pref_language`

`account_id` PK/FK, `interface_code text not null default 'en'`, `updated_at`.

### `pref_narration`

The read-aloud voice. `account_id` PK/FK, `voice_id text` (null = platform
default), `rate numeric not null default 1`, `updated_at`.

### `pref_notifications`

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | |
| `paused_until` | timestamptz | null = not paused |
| `product_updates` | boolean not null default true | |
| `offers` | boolean | |
| `tips` | boolean | |
| `weekly_summary` | boolean | |
| `monthly_recap` | boolean | |
| `frequency` | `notify_frequency` | `instant \| daily \| weekly` |
| `updated_at` | timestamptz | |

Email-level checkboxes from the `tirbeo:email-prefs` store go in
`pref_notification_channels` (`account_id, channel, topic, enabled`), so a topic
can be on for push and off for email without a second blob.

### `pref_data_permissions`

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | |
| `personalised` | boolean not null default true | |
| `share_with_partners` | boolean not null default false | |
| `analytics_cookies` | boolean not null default false | |
| `marketing_cookies` | boolean not null default false | |
| `updated_at` | timestamptz | |
| `updated_ip` | inet | a consent record wants a stamp of where it was given |
| `updated_user_agent` | text | ditto |

Consent rows carry provenance because the app can be asked to *prove* a user
agreed, and a bare boolean cannot.

### `pref_security`

`savedLogin` (`tirbeo:security`) and "last active" (`tirbeo:last-active`).

| column | type | notes |
| --- | --- | --- |
| `account_id` | uuid PK/FK | |
| `remember_this_device` | boolean not null default false | |
| `last_active_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## 13. Seed / reference data

No user writes these; the app reads them to render text.

| table | replaces | columns |
| --- | --- | --- |
| `places` | `lib/places.ts` | §2 |
| `oauth_providers` | `connected-apps.ts` catalogue | §6 |
| `docs_articles` / `policies` | `help-policies.ts`, `lib/docs.ts` | §11 |
| `guideline_topics` | the `guideline` strings on status items | `id, slug, title, href` |
| `change_descriptors` | `ChangeKind` → a human sentence + icon-free label | `kind text PK, label text, description text` |

Keeping `change_descriptors` server-side is what lets the activity-log page show
a *sentence* rather than an enum value, and lets the wording change without a
client release.

---

## 14. Client-only state (deliberately no table)

Anything that is a property of *this browser*, not of the account, must not be
synced. Syncing it makes a phone change your laptop.

| key | why it stays local |
| --- | --- |
| `tirbeo:theme`, `tirbeo:language` when unset for the account | first-paint flash: the app must know before the API answers. Server value wins once loaded (`pref_theme`, `pref_language`). |
| `tirbeo:narration` session position, `tirbeo:docs` figure pref | playback state, meaningless on another device |
| `tirbeo:mt:`, `tirbeo:mt:v3:` | transient UI/motion cache |
| the "skip for now" dismissal of a **skippable** lock | the server owns the lock (`account_locks`); the client owns only the fact that it has been dismissed this session |
| `tirbeo_session` cookie | transport, not data |
| `tirbeo:account-status:skipped` | becomes the dismissal above — the three hardcoded ids (`blocked-lagos`, `changes-on-hold`, `confirm-pokhara`) move to `account_locks` rows |
| `tirbeo:visibility`, `tirbeo:mentions` | no owning screen exists; see §19 |

---

## 15. localStorage → table map

The migration story in one table, so nobody has to re-derive it later.

| store | lands in |
| --- | --- |
| `profile` | `profiles` |
| `personal-details` | `personal_details`, `skills`, `accounts.email/phone` |
| `edit-profile` (draft) | nothing — a draft is per-browser (§14) |
| `devices` | `devices` |
| `devices:log` | `session_events` |
| `login-activity` | `login_events`, `login_event_reviews` |
| `activity-log` | `change_log`, `change_log_responses` |
| `activity-log:answers` | `change_log_responses` (legacy alias) |
| `connected-apps` | `connected_apps` |
| `connected-apps:history` | `disconnect_events` |
| `two-factor` | `two_factor` |
| `two-factor-secret` | `two_factor.secret` (encrypted) — **removed from the client** |
| `backup-codes` | `backup_code_sets`, `backup_codes` |
| `backup-codes:rate`, `download-requests:rate` | `auth_rate_limits` |
| `passkeys` | `passkeys` |
| `account-status` | `status_sections`, `status_items` (server-authored) |
| `account-status:appeals` | `appeals` |
| `account-status:skipped` | `account_locks` + a session dismissal |
| `account-state` | `account_locks`, `accounts.state` |
| `account-requests` | `account_requests` |
| `welcome-back` | `welcome_back_events` |
| `account-deactivation` | `deactivation_plans` |
| `account-deletion` | `deletion_plans` |
| `download-requests` | `export_archives` |
| `your-activity` | `activity_daily_totals` |
| `your-activity:deleted` | `deleted_items` |
| `support-requests` | `support_requests` |
| `docs-helpful` | `content_votes` |
| `docs` | `docs_articles` |
| `notifications`, `email-prefs` | `pref_notifications`, `pref_notification_channels` |
| `data-permissions` | `pref_data_permissions` |
| `security`, `last-active` | `pref_security`, `sessions` |
| `theme`, `language`, `narration` | `pref_theme`, `pref_language`, `pref_narration` |
| `recovery-email` | `recovery_emails` |
| `recently-deleted` | `deleted_items` |
| `visibility`, `mentions` | *(dropped — §19)* |

---

## 16. Row Level Security

One principle: **a user may read and write only their own rows, and may not
write rows the server owns.** Supabase-style policies, expressed as roles.

| pattern | tables | policy |
| --- | --- | --- |
| Owner read+write | `profiles`, `personal_details`, `skills`, `pref_*`, `passkeys` (name only), `content_votes`, `appeals` (insert) | `using (account_id = auth.account_id())` for select and update |
| Owner read, server write | `devices`, `sessions`, `login_events`, `session_events`, `security_events`, `change_log`, `disconnect_events`, `welcome_back_events` | select for owner; **no insert/update/delete grant** to `authenticated` |
| Owner read only | `status_sections`, `status_items`, `account_locks`, `deletion_plans`, `deactivation_plans` | select for owner; writes come from staff/service roles |
| Server-authoritative answers | `change_log_responses`, `login_event_reviews`, `accounts.state` | owner may insert/update *only* the response columns via an API function, never the underlying event |
| Public read | `docs_articles` (published), `oauth_providers`, `places`, `guideline_topics`, `change_descriptors` | select for `anon` |
| Never readable by a client | `two_factor.secret`, `backup_codes.code_hash`, `passkeys.public_key` | excluded from every read endpoint; touched only by the verifying function, which has one job and returns a boolean |

Two things this table exists to make obvious:

1. **The client must never be able to write its own history.** Today every
   `login_events`, `change_log` and `devices` row is minted in the browser, so a
   user (or an attacker with the token) can rewrite it. Post-RLS, the app can
   *read* those tables and *answer* review prompts, nothing else.
2. **Secrets are read by a function, not by a row.** `two_factor.secret` is
   decryptable only inside `verify_totp()`, which is `security definer` and
   selectable by nobody. That is what replaces the localStorage secret store.

---

## 17. Indexes that matter

```sql
-- every history page in the app is reverse-chronological, owner-scoped
create index login_events_account_at_idx    on login_events (account_id, at desc);
create index change_log_account_at_idx      on change_log (account_id, at desc);
create index session_events_account_at_idx  on session_events (account_id, at desc);
create index security_events_account_at_idx on security_events (account_id, at desc);

create index devices_account_last_active_idx  on devices (account_id, last_active_at desc);
create index sessions_live_idx                on sessions (account_id) where revoked_at is null;
create index account_locks_open_idx           on account_locks (account_id) where lifted_at is null;
create index status_items_open_idx            on status_items (account_id) where resolved_at is null;
create index deleted_items_purge_idx          on deleted_items (purge_at) where restored_at is null;
create index export_archives_account_idx      on export_archives (account_id, requested_at desc);
create index activity_totals_account_idx      on activity_daily_totals (account_id, metric, day);
create index login_events_suspicious_idx      on login_events (account_id, at desc) where suspicious;
```

`login_events_suspicious_idx` is the one that keeps "alert me about suspicious
sign-ins" cheap as the account ages.

---

## 18. Enums

```sql
create type account_state as enum ('active','locked','restricted','deactivated','pending_deletion');
create type device_kind as enum ('computer','phone','tablet');
create type session_event_kind as enum ('signed-out','signed-out-all');
create type login_event_kind as enum ('signin','signout','failed','password','two-factor','passkey');
create type login_review as enum ('me','not-me');
create type change_response as enum ('recognised','not-me');
create type revoke_reason as enum ('signed_out','signed_out_all','password_changed','two_factor_off','admin','expired');
create type section_severity as enum ('ok','warning','action');
create type appeal_status as enum ('submitted','in-review','upheld','reversed');
create type request_kind as enum ('deactivation','deletion','appeal');
create type request_outcome as enum ('open','restored','reversed','reviewed');
create type lock_kind as enum ('deletion','deactivated','restriction');
create type welcome_kind as enum ('reactivated','deletion-cancelled');
create type archive_format as enum ('json','html');
create type archive_scope as enum ('everything','profile');
create type archive_status as enum ('queued','building','ready','failed','expired');
create type origin_kind as enum ('article','policy');
create type support_status as enum ('open','answered','closed');
create type content_kind as enum ('article','policy');
create type helpful_vote as enum ('yes','no');
create type notify_frequency as enum ('instant','daily','weekly');
```

`change_kind` is intentionally **not** an enum: the client's `ChangeKind` list has
already drifted from what the app can change, and §13's `change_descriptors`
gives the same guarantee with a foreign key that can be extended without a
migration.

---

## 19. Known gaps and decisions to make before wiring

Raised here rather than discovered mid-migration:

1. **`visibility` and `mentions`** — referenced only by the export group list in
   `download-data.ts`, owned by no screen. Either those two settings are real and
   need screens plus tables (`profile_visibility`, `mention_preferences`), or
   they get dropped from the export manifest. **Recommend dropping**, since a
   `data-export` that promises a table nobody can configure is worse than one
   with two fewer rows.
2. **Followers/following counters** are denormalised on `profiles` because this
   app only displays them. The moment the app can follow anyone, they move to a
   `follows` table and the counters become a maintained rollup.
3. **`accounts.email` vs `account_emails`** — keep both during the transition,
   then make `accounts.email` a generated column pointing at the
   `primary` row. The app reads one field; the DB stores the truth once.
4. **IP addresses are personal data.** `login_events.ip`, `change_log.ip`,
   `devices.ip` and `pref_data_permissions.updated_ip` all need the same
   retention rule as `deleted_items.purge_at` — the export manifest should
   disclose it, and the deletion job must honour it.
5. **Every write the app makes today is a *fact about the client*.** After
   wiring, the API becomes the only place `change_log` rows are created, which
   means the profile/details screens must POST a *desired value* and let the
   server compute `from → to`. The per-field error text and `ReqNote` validation
   already in the UI carry over unchanged; the required-field rules move server
   side (§2).
6. **Rate limits move server-side** (§5). Until they do, "you can only request an
   export N times" is decoration.
