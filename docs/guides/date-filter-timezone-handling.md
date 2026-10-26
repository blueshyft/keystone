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
one order dated October 24 in the admin UI; selecting October 24 again in the
current browser returns the same result. So the specific report is not
reproducing in the current session. The linked filter value is
`2026-10-24T01:00:00.000Z`, which is noon on October 24 at UTC+11. The live
SodaKing host reports AEDT, and its Node process has no `TZ` override, so the
browser and server appear to have used the same timezone for this report. The
timezone mismatch in the shared implementation is still a real Keystone bug
when a browser and server use different timezones, but current evidence does
not establish that it caused this particular SodaKing result.

## Keystone consumers to roll forward

These local Blueshyft repositories pin the custom Keystone fork and need to
install a release containing this change, rebuild, and deploy before their
admin filters use it:

| Current Keystone pin | Consumers |
| --- | --- |
| `blu-v4.3.0` | `alipay-platform`, `coinspot-platform`, `cointree-platform`, `cs-dashboard-old`, `goget-platform`, `logistics-api`, `mmg-platform`, `payments`, `sodaking-api`, `toll-ftp`, `toll-platform`, `transactions-api`, `website-v2` |
| `blu-v4.3.1` | `core`, `parcels-platform`, `reports`, `tnt-api` |

`marketing-platform` (`blu-v4.2.1`) and `tge-platform`
(`blu-v4.2.1-google`) are separate pinned branches; backport this fix there if
their date filters are in scope. Keep `marketing-platform` on its current pin
unless its separate Keystone upgrade is approved. `template-platform`,
`havven-website`, and `parcels-sdk` use other Keystone versions and need a
separate compatibility review if they expose admin date filters.

The SodaKing production app still pins `blu-v4.3.0`; this source change does
not reach production until the custom Keystone release is published and the
consumer dependency is updated and deployed.
