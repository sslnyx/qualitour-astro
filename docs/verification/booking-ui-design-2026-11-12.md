# Native booking UI refinement

Approved scope: improve full booking page, shortcut dialog and calendar; integrate with the website style. Same-origin Sandbox API only; no live payment activation.

Current browser inspection found a duplicate brand/language header, empty recovery panel before the form, native date control and long time dropdown. The separate cream background made booking feel detached from the website.

Chosen implementation: retain the website header/footer and inherited font; neutral gray background, white rounded cards and orange gradient primary actions. Put trip selection first, use an inline month calendar with bounded month navigation and grouped time buttons. Display a live trip summary. Reveal contact details after a server quote and keep an explicit edit-trip action. Collapse recovery under the main task. Use the same React experience in the dialog and full page.

Preserve route/rate validity, service weekdays, one-hour lead time, booking horizon, quote expiry and input matching, customer-only endpoints, idempotency and Sandbox acknowledgment. Dates are operating schedules; actual vehicle availability remains server-verified.

Release coordination: CMS/native-proof chat is the sole Worker publisher. Deliver exact owned commit and paths after local validation, then verify the published Sandbox UI in the browser.

## Local acceptance

- Automated native calendar/routing/booking suite: 17 tests passed. Covers leap years, month boundaries, dynamic service/rate bounds, roving tab stop after a cutoff change, and Home/End within a partly disabled week.
- Astro diagnostics: 0 errors, 0 warnings; 249 hints from existing/generated files. `git diff --check` passed.
- In-app browser, viewport emulation: desktop 1440×1000; mobile 390×844; narrow 350×780. This is not real-device testing.
- Shared modal opens from the exact YVR → Whistler 11-seat card. Fixed product selection avoids duplicate route/vehicle controls inside the modal.
- Local UI through an untracked development proxy to the existing Sandbox obtained CAD 465.00 server quotes for November 29 11:00 and November 30 14:00. Both advanced to step 2. No bookings or charges were created during this local pass.
- Selected date computed margin is 0 and height is 44px. Mobile page and dialog had no horizontal overflow; modal Escape restored card-button focus and page scroll.
- Screenshots in `output/booking-ui/`: calendar-desktop.jpg, contact-desktop.jpg, modal-mobile.jpg. These are local browser evidence, not a published-release claim.

Independent review found and corrected Home/End skipping across a week boundary and a selected-date margin collision. Quote expiry and changed-input matching, exact-product entry and Sandbox restrictions were retained.

## Scoped recovery and coverage

Pre-change source copies are in `.astro/booking-ui-backup/`. BookingView SHA-256 `05843a6baab6b1d463eff2c56ddfadd8d85af5c1397e59de6e3fd5b3f6b5db03`; booking.css `0103ee894d799bcb2b0a4f45acbc5536d4226e91d72a466023df414a42885746`. Both compare byte-for-byte with base commit `bc80125`. This is a scoped source recovery backup, not a hosting backup or restore rehearsal. The two new calendar files can be removed and the other owned source paths restored from `bc80125` in an isolated rollback commit.

| Requirement | Status before publication | Evidence |
|---|---|---|
| Match website appearance | Verified locally; public check pending | Shared site header/footer, inherited font, neutral cards/orange actions; current browser screenshots |
| Improve calendar/time selection | Verified locally; public check pending | 9 calendar behavioral tests, bounded month select, grouped 24-hour time buttons, zero selected-day margin |
| Shared full page/modal | Verified locally; public check pending | Same BookingView/controller; exact product preselection, modal quote step 2 and Escape focus restoration |
| Same-origin Sandbox API | Verified | Existing Sandbox CAD465 quotes; backend/bindings/payment configuration unchanged by UI commit |
| Language navigation | Verified locally; public check pending | `/zh/book?product=transfer-product-18` → `/book?product=transfer-product-18&lang=en`; successful English evening quote and focused contact heading |
| Real payment activation | Not applicable | Explicitly excluded by user; no live key or payment configuration change |

Code commit handed to the sole publisher: `d04a247`. Exact owned source paths are listed by that commit; CMS/release-script dirty work was excluded. No new notifications, live payments or delivery systems were tested in this UI pass.

## Published Sandbox acceptance

The sole publisher deployed source `ee8ce1e8ec1d18470bc4944e9cb3a4443de08136` containing UI commit `d04a247` to the existing `qualitour` Worker. Publisher readback: version `d4898633-a94b-4cd0-90b7-4a4cc41b6bed`, deployment `b2feddce-039f-4555-bc48-7558207747a9`. No separate UI deployment was performed.

Public browser coverage, without an admin session:

- `https://qualitour.qualitour.workers.dev/zh/book?product=transfer-product-18`: native month calendar/time chips, no duplicate brand header, CAD465 server quote for 2 passengers, step 2 and focus on its heading.
- `https://qualitour.qualitour.workers.dev/zh/private-transfers`: 14-seat CAD595 product shows “not open for test booking” rather than falling back. The exact 11-seat CAD465 card opens the shared mobile dialog with its fixed route/vehicle controls hidden.
- Mobile dialog → quote → synthetic reservation succeeded for November 30, 2026, 14:00 Vancouver, 2 passengers, international terminal 51 → Whistler 19. Synthetic order `e235e5af-5281-4236-bb90-33670d392c58`, reference `QTS-E235E5AF52814236`.
- The management page showed that order's correct date, passengers, amount and unpaid status. Cancel succeeded; the English management page also showed **Test booking cancelled**, same reference and **Unpaid**. No Stripe Checkout button was used in this pass.
- `/book/manage/e235e5af-5281-4236-bb90-33670d392c58?lang=zh` → `?lang=en` retained the booking ID and opened the correct English shell. Local generic product-language switching was also checked before release.
- Public viewport checks: 1440×1000 desktop, 390×844 mobile dialog, 350×780 narrow full page. Narrow page width equaled viewport width (350px), selected day margin was 0, and no iframe was present. Viewport override was reset after acceptance. This is responsive emulation, not physical-device/Safari testing.

The three UI requirements previously marked public-check-pending are now **verified on staging**. Synthetic reservation is cancelled. Live payment activation remains excluded. Existing backend payment integration was unchanged; this UI pass tested quoting/reservation/cancellation, not a new payment capture or notification delivery.

Published screenshots: `output/booking-ui/calendar-staging-desktop.jpg`, `contact-staging-desktop.jpg`, `modal-staging-mobile.jpg`, `cancelled-staging-mobile.jpg`, `cancelled-staging-desktop.jpg`. The desktop cancellation screenshot includes the visible cancelled state; the mobile screenshot is scrolled to the unpaid summary.
