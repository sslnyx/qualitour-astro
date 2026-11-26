/**
 * The custom charter quote popup on the private transfers page. Any link marked `data-charter-quote="<vehicle id>"`
 * (empty for "not sure") opens it. Until this script has loaded, and on modified clicks, the link still goes to the
 * contact page. What was typed is kept if the popup is closed without sending.
 */
import { useEffect, useId, useRef, useState } from "react";
import { ApiError, bookingApi } from "../lib/booking/api";
import {
    emptyQuote,
    quoteErrors,
    quotePayload,
    vancouverToday,
    type CharterQuoteForm,
    type CharterQuoteProblem,
    type CharterQuoteVehicle,
} from "../lib/charter-quote.mjs";

const copy = {
    en: {
        title: "Request a custom quote", intro: "Tell us about your trip and we will reply by email with a quote.",
        contact: "Your details", vehicleSection: "Vehicle and time", trip: "Your trip",
        name: "Full name", email: "Email", phone: "Phone", vehicleModelId: "Vehicle", unsure: "Not sure yet",
        travelDate: "Date", startTime: "Start time", hours: "Estimated hours", passengers: "Passengers",
        pickup: "Pick-up location", itinerary: "Destinations or itinerary", luggage: "Luggage", notes: "Anything else",
        itineraryHint: "Where you want to go, stops, and number of days", luggageHint: "e.g. 6 suitcases, ski gear",
        optional: "optional", submit: "Send request", sending: "Sending…", close: "Close",
        required: "Please fill in this field", emailProblem: "Please enter a valid email address",
        past: "Please choose today or a later date", passengersProblem: "Please enter a whole number from 1 to 500",
        hoursProblem: "Please enter between 0.5 and 240 hours", invalid: "Please check the highlighted fields.",
        busy: "Too many requests were sent. Please try again later, or call +1 (778) 945-6000.",
        failed: "Your request could not be sent. Please try again, or call +1 (778) 945-6000.",
        sentTitle: "Request received", sent: "Thank you. We will reply to you by email.", reference: "Reference number",
    },
    zh: {
        title: "訂製包車報價", intro: "請告訴我們您的行程，我們會以電郵回覆報價。",
        contact: "聯絡資料", vehicleSection: "車型與時間", trip: "行程",
        name: "姓名", email: "電郵地址", phone: "電話", vehicleModelId: "車型", unsure: "不確定",
        travelDate: "用車日期", startTime: "開始時間", hours: "預計時數", passengers: "乘客人數",
        pickup: "上車地點", itinerary: "目的地或行程", luggage: "行李", notes: "備註",
        itineraryHint: "想去的地點、中途停靠、天數", luggageHint: "例如：6 件行李箱、滑雪裝備",
        optional: "選填", submit: "送出申請", sending: "送出中…", close: "關閉",
        required: "請填寫此欄位", emailProblem: "請輸入有效的電郵地址",
        past: "請選擇今天或之後的日期", passengersProblem: "請輸入 1 至 500 的整數",
        hoursProblem: "請輸入 0.5 至 240 小時", invalid: "請檢查標示的欄位。",
        busy: "送出次數太多，請稍後再試，或致電 +1 (778) 945-6000。",
        failed: "無法送出申請，請再試一次，或致電 +1 (778) 945-6000。",
        sentTitle: "已收到您的申請", sent: "謝謝，我們會以電郵回覆您。", reference: "參考編號",
    },
} as const;

type Field = Exclude<keyof CharterQuoteForm, "website">;
const OPTIONAL: Field[] = ["phone", "vehicleModelId", "startTime", "hours", "luggage", "notes"];
const MAX_LENGTH: Partial<Record<Field, number>> = { name: 100, email: 254, phone: 40, pickup: 300, itinerary: 2000, luggage: 300, notes: 2000 };
const control =
    "w-full min-h-11 rounded-lg border bg-white px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#b84e00]/30 disabled:bg-gray-50 disabled:opacity-70";

export default function CharterQuoteDialog({ lang, vehicles }: { lang: "en" | "zh"; vehicles: CharterQuoteVehicle[] }) {
    const t = copy[lang];
    const id = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const requestId = useRef("");
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<CharterQuoteForm>(() => emptyQuote());
    const [errors, setErrors] = useState<Partial<Record<keyof CharterQuoteForm, CharterQuoteProblem>>>({});
    const [sending, setSending] = useState(false);
    const [failure, setFailure] = useState("");
    const [reference, setReference] = useState("");

    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const trigger = (event.target as Element | null)?.closest<HTMLElement>("[data-charter-quote]");
            if (!trigger) return;
            event.preventDefault();
            triggerRef.current = trigger;
            const vehicle = trigger.dataset.charterQuote ?? "";
            // A button without a vehicle keeps whatever the visitor already chose.
            if (vehicle) {
                requestId.current = "";
                setForm((current) => ({ ...current, vehicleModelId: vehicle }));
            }
            setOpen(true);
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!open || !dialog) return;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            if (dialog.open) dialog.close();
            document.body.style.overflow = previousOverflow;
            triggerRef.current?.focus({ preventScroll: true });
        };
    }, [open]);

    const close = () => {
        setOpen(false);
        setReference("");
        setFailure("");
    };

    const change = (field: keyof CharterQuoteForm, value: string) => {
        // An edited form is a new request; an unchanged retry is the same one, so it is never saved twice.
        requestId.current = "";
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: undefined }));
    };

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (sending) return;
        const problems = quoteErrors(form);
        setErrors(problems);
        const first = Object.keys(problems)[0];
        if (first) {
            setFailure(t.invalid);
            (event.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
            return;
        }
        setSending(true);
        setFailure("");
        try {
            requestId.current ||= crypto.randomUUID();
            const result = await bookingApi<{ reference: string }>(
                "enquiries",
                quotePayload(form, { lang, requestId: requestId.current, vehicles }),
            );
            setReference(result.reference);
            setForm(emptyQuote());
            requestId.current = "";
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 0;
            setFailure(status === 429 ? t.busy : status === 400 ? t.invalid : t.failed);
        } finally {
            setSending(false);
        }
    };

    const problemText = (problem: CharterQuoteProblem) =>
        ({ required: t.required, email: t.emailProblem, past: t.past, passengers: t.passengersProblem, hours: t.hoursProblem })[problem];

    const field = (name: Field, props: React.InputHTMLAttributes<HTMLInputElement> = {}, options: { wide?: boolean; hint?: string; rows?: number } = {}) => {
        const optional = OPTIONAL.includes(name);
        const problem = errors[name];
        const shared = {
            id: `${id}-${name}`,
            name,
            value: form[name],
            required: !optional,
            disabled: sending,
            maxLength: MAX_LENGTH[name],
            "aria-invalid": Boolean(problem),
            "aria-describedby": problem ? `${id}-${name}-error` : undefined,
            className: `${control} ${problem ? "border-red-600" : "border-gray-300 focus:border-[#b84e00]"}`,
        };
        return (
            <div className={`flex min-w-0 flex-col gap-1 ${options.wide ? "sm:col-span-2" : ""}`}>
                <label htmlFor={shared.id} className="text-sm font-medium text-gray-800">
                    {t[name]}
                    {optional && <span className="ml-1 font-normal text-gray-500">({t.optional})</span>}
                </label>
                {name === "vehicleModelId" ? (
                    <select {...shared} onChange={(event) => change(name, event.target.value)}>
                        <option value="">{t.unsure}</option>
                        {vehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>
                        ))}
                    </select>
                ) : options.rows ? (
                    <textarea {...shared} rows={options.rows} placeholder={options.hint} onChange={(event) => change(name, event.target.value)} />
                ) : (
                    <input {...props} {...shared} placeholder={options.hint} onChange={(event) => change(name, event.target.value)} />
                )}
                {problem && <p id={`${id}-${name}-error`} className="text-sm text-red-700">{problemText(problem)}</p>}
            </div>
        );
    };

    const section = (title: string, children: React.ReactNode) => (
        <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-bold text-[#b84e00]">{title}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
        </fieldset>
    );

    if (!open) return null;

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={`${id}-title`}
            className="fixed inset-0 m-auto w-[calc(100%_-_1.5rem)] max-w-2xl overflow-hidden rounded-2xl bg-white p-0 text-left shadow-2xl backdrop:bg-black/60"
            onCancel={(event) => {
                event.preventDefault();
                close();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <div className="relative flex max-h-[90dvh] flex-col">
                <div className="shrink-0 bg-gray-900 p-4 pr-16 text-white sm:px-6 sm:pr-16">
                    <h2 id={`${id}-title`} className="text-xl font-bold">{t.title}</h2>
                    <p className="mt-1 text-sm text-gray-300">{t.intro}</p>
                    <button
                        type="button"
                        aria-label={t.close}
                        onClick={close}
                        className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                    >
                        <span className="material-icons" aria-hidden="true">close</span>
                    </button>
                </div>
                <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
                    {reference ? (
                        <div role="status" className="py-8 text-center">
                            <span className="material-icons text-5xl text-green-600" aria-hidden="true">check_circle</span>
                            <h3 className="mt-3 text-2xl font-bold text-gray-900">{t.sentTitle}</h3>
                            <p className="mt-2 text-gray-600">{t.sent}</p>
                            <p className="mt-4 text-sm text-gray-500">{t.reference}</p>
                            <p className="text-lg font-bold tracking-wide text-gray-900">{reference}</p>
                            <button type="button" onClick={close} className="mt-6 min-h-11 rounded-xl bg-gray-900 px-8 py-3 font-medium text-white hover:bg-gray-800">
                                {t.close}
                            </button>
                        </div>
                    ) : (
                        <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
                            {section(t.contact, <>
                                {field("name", { type: "text", autoComplete: "name" })}
                                {field("email", { type: "email", autoComplete: "email" })}
                                {field("phone", { type: "tel", autoComplete: "tel" })}
                            </>)}
                            {section(t.vehicleSection, <>
                                {field("vehicleModelId")}
                                {field("passengers", { type: "number", min: 1, max: 500, inputMode: "numeric" })}
                                {field("travelDate", { type: "date", min: vancouverToday() })}
                                {field("startTime", { type: "time" })}
                                {field("hours", { type: "number", min: 0.5, max: 240, step: 0.5, inputMode: "decimal" })}
                            </>)}
                            {section(t.trip, <>
                                {field("pickup", { type: "text" }, { wide: true })}
                                {field("itinerary", {}, { wide: true, rows: 4, hint: t.itineraryHint })}
                                {field("luggage", { type: "text" }, { wide: true, hint: t.luggageHint })}
                                {field("notes", {}, { wide: true, rows: 2 })}
                            </>)}
                            {/* Hidden from people; automated form fillers complete it and their request is dropped. */}
                            <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
                                <label>
                                    Website
                                    <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => change("website", event.target.value)} />
                                </label>
                            </div>
                            {failure && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{failure}</p>}
                            <button type="submit" disabled={sending} className="min-h-12 rounded-xl bg-[#b84e00] px-6 py-3 font-semibold text-white hover:bg-[#963f00] disabled:cursor-not-allowed disabled:opacity-70">
                                {sending ? t.sending : t.submit}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </dialog>
    );
}
