# Date filter timezone handling

Keystone date filters represent calendar days selected in the admin UI. The
browser serializes JavaScript `Date` values as UTC timestamps, while the server
previously rebuilt the start and end of the day in its own local timezone. If
the browser and server timezones differ, those boundaries can cover a different
calendar day from the one shown in the filter UI.

This is shared behavior: `DatetimeType` inherits its filter query from
`DateType`, and `DateArrayType` delegates to it. Affected fields include
`Date`, `Datetime`, and date arrays in every application using this Keystone
implementation.

The admin filter parser now records the browser's exact start-of-day and
next-day boundaries. Keystone uses half-open ranges (`$gte` start, `$lt` next
day) for on/between filters, which also handles daylight-saving days that are
23 or 25 hours long. Existing filter URLs are normalized when parsed. Direct
API callers that omit these boundary fields keep the prior server-local
behavior.

Keystone 4.3.3 also restores the built-in password sign-in page as an opt-in
for apps that need it. Set `password auth enabled` to `true`; the default keeps
the existing Google sign-in redirect.

## SodaKing report and current reproduction

On 2026-10-26, SodaKing reported that filtering Stock Orders by `createdAt` on
October 24 showed an October 25 result. The linked live filter currently returns
one order dated October 24 in the admin UI; selecting October 24 again after the
canary deploy returns the same result. The link's value,
`2026-10-24T01:00:00.000Z`, is noon on October 24 at UTC+11. The live host reports
AEDT, and the app has no `TZ` override in its production environment, so current
evidence does not connect the reported result to a browser/server timezone
mismatch. The shared timezone defect is still real when those zones differ, but
it is not a confirmed cause of this particular report.

## Keystone rollout status (2026-10-26)

The common fork line is `blu-v4.3.3`, resolving to
`9239b83417a7195b1faae77fccdc98f748192fcf`. Package and lockfile changes have
been pushed for the upgraded fleet consumers.

| Status | Consumer and target | Evidence |
| --- | --- | --- |
| Deployed | `alipay-platform`, `cointree-platform`, `mmg-platform`, `reports` — live | `npm ls` resolves Keystone 4.3.3 and health routes returned HTTP 200 with valid TLS. MMG and Reports workers kept their original processes. |
| Deployed | `sodaking-api` — live | Release commit `808918c`; Keystone resolves to `9239b834`. Health returned HTTP 200 with valid TLS. Only the API process was reloaded; the worker was left running. |
| Deployed | `marketing-platform` — live | Release commit `3d940bf`; Keystone 4.3.3 and `password auth enabled: true`. Health and `/keystone/signin` returned HTTP 200 with valid TLS; sign-in no longer redirects to Google. The separate worker service stayed active. |
| Deployed | `coinspot-platform` — live | PM2 release at `3447d8c` completed and `/health` returned HTTP 200 with valid TLS. The installed dependency tree was not checked directly over SSH because no trusted host-key pin was available. |
| Deployed | `toll-platform`, `toll-ftp` — live and staging | Keystone resolves to 4.3.3 and health routes returned HTTP 200 with valid TLS. Live's read-only SFTP health check passed; staging SFTP was not exercised. |
| Deployed | `website-v2`, `cs-dashboard-old` — General Live | Both resolve to Keystone 4.3.3; `www`, `website`, and `dashboard` health routes returned HTTP 200 with valid TLS. PUDO Explorer processes were not restarted. |
| Deployed | `website-v2`, `cs-dashboard-old`, `core` — Core Staging | All three resolve to Keystone 4.3.3. Core and site health routes returned HTTP 200 with valid TLS; the existing `core-workers` process was left untouched. |
| Deployed | `transactions-api` — live and staging | Both resolve to Keystone 4.3.3 and health returned HTTP 200 with valid TLS. Staging's single API process was restarted directly so embedded scheduled jobs did not overlap across instances. |
| Deployed | `goget-platform` — live | The host's installed tree resolves to Keystone 4.3.3 at `9239b834`; Git fetch reached master `05a95ad6`. `/health` returned HTTP 200 with valid TLS. |
| Deployed | `logistics-api`, `payments`, `parcels` — staging and live as applicable | Package updates were deployed and public health routes returned HTTP 200 with valid TLS. The `payments` and `parcels` worker processes were left untouched. |
| Already current | `tnt-api` — live | Already resolved to Keystone 4.3.3; health returned HTTP 200 with valid TLS. A read-only deployment key enables server-side Git checkout. |
| Candidate only | `core` — Ubuntu 26.04.1 production candidate | Keystone 4.3.3 installed and `/health` returned HTTP 200 with valid TLS. No EIP or traffic cutover was made. |

The four copied source trees on Alipay, Cointree, MMG, and Reports are not Git
worktrees. Their repo-scoped deploy keys already worked, and server-side Git
checkouts confirmed the expected commits. Their first manifest staging pass
used SCP before the user corrected the process; that should not be repeated.
Future server updates must use read-only deploy-key checkouts and strict
host-key checking.

## Remaining scope and verification gaps

`sandbox-staging` is the remaining upgraded host whose Keystone consumer has not
been updated. The application repository is not present in the local Blueshyft
workspace, and no trusted SSH host-key entry for the current host was available;
the instance was left unchanged. The source is identified in the fleet inventory
as `blueshyft-sandbox` at `46380c9`.

The live `coinspot-platform` PM2 release and public health check succeeded, but
the installed dependency tree could not be read over SSH without a trusted host
key. No host-key check was bypassed. TGE staging remains stopped.
`template-platform`, `havven-website`, and `parcels-sdk` use other Keystone
versions and remain outside this upgraded Ubuntu/Node rollout scope.

Transactions was included after its migration. The private `transactions-new`
instance remains stopped as requested. No EIP or DNS changes were made for this
Keystone rollout.
