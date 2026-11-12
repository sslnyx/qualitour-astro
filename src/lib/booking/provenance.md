# Native booking UI provenance

Copied from `qualitour-ops` commit `48d1150` and adapted for the Astro frontend.

| Source                               | SHA-256                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| `web/components/BookingView.tsx`     | `da625c755a852d6a24e6bece25e40f04f663f1d96ea5dad577c77034a783e6da` |
| `web/components/BookingRecovery.tsx` | `e141d95b9173647b132bc8a800dd3d149d36753c442042016379361dce8b9150` |
| `web/booking-ui-contracts.ts`        | `135027f54162690de207077d07c3f8734e736314ede2a8c6b2ec2e9578c142cc` |
| `web/booking.css`                    | `1f23be69eb1107053c9945255fdc4b4e5f04856a40b34c2c7e155b935bcca301` |
| `web/booking-errors.ts`              | `2204570ad1ff79366618540b9ad38e11ec24c0d66988421a7a2f0da9033ee7c5` |

The controller uses the same request and response fields while targeting the
same-origin `/api/transfer/*` staging proxy. The Sandbox notice and server-side
price, availability and payment checks remain part of the reused experience.
