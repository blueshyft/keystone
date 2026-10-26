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

## Keystone consumers to roll forward

These local Blueshyft repositories pin the custom Keystone fork and need to
install a release containing this change, rebuild, and deploy before their
admin filters use it:

| Current Keystone pin | Consumers |
| --- | --- |
| `blu-v4.3.0` | `alipay-platform`, `coinspot-platform`, `cointree-platform`, `cs-dashboard-old`, `goget-platform`, `logistics-api`, `mmg-platform`, `payments`, `toll-ftp`, `toll-platform`, `transactions-api`, `website-v2` |
| `blu-v4.3.1` | `core`, `parcels-platform`, `reports`, `tnt-api` |
| `blu-v4.3.2` | `sodaking-api` (live canary deployed 2026-10-26) |

`marketing-platform` (`blu-v4.2.1`) and `tge-platform`
(`blu-v4.2.1-google`) are separate pinned branches; backport this fix there if
their date filters are in scope. Keep `marketing-platform` on its current pin
unless its separate Keystone upgrade is approved. `template-platform`,
`havven-website`, and `parcels-sdk` use other Keystone versions and need a
separate compatibility review if they expose admin date filters.

SodaKing is the first live consumer on `blu-v4.3.2`; its lockfile resolves the
Keystone release commit. The other listed apps still need their dependency
updated, rebuilt, and deployed before the fix reaches them.
