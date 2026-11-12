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
