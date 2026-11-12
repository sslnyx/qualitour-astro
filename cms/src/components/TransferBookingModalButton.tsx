/**
 * TransferBookingModalButton - React component for Astro
 * 
 * Opens a modal with Zaui booking iframe for transfers.
 * Uses client:load directive in Astro for client-side interactivity.
 */

import { useEffect, useId, useState } from 'react';

type Props = {
    label: string;
    activityId: string;
    localePrefix: string;
    lang?: 'en' | 'zh';
    variant?: 'primary' | 'secondary';
};

function getBookingUrl(activityId: string): string {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return `https://qualitour.zaui.net/booking/web/#/default/activity/${activityId}?date=${dateStr}`;
}

export default function TransferBookingModalButton({
    label,
    activityId,
    localePrefix,
    lang = 'en',
    variant = 'primary',
}: Props) {
    const [open, setOpen] = useState(false);
    const dialogTitleId = useId();

    const bookingUrl = getBookingUrl(activityId);

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    const buttonClassName =
        variant === 'primary'
            ? 'block w-full px-4 py-2 rounded-md bg-[#f7941e] hover:bg-[#e68a1c] text-white font-semibold transition-colors'
            : 'block w-full px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-900 font-semibold transition-colors';

    const ui =
        lang === 'zh'
            ? {
                heading: '预订',
                hint: '如果无法加载，请使用"新窗口打开"。',
                openNewTab: '新窗口打开',
                close: '关闭',
                closeAria: '关闭弹窗',
                iframeTitle: 'Zaui 预订',
            }
            : {
                heading: 'Booking',
                hint: 'If it doesn\'t load, use "Open in new tab".',
                openNewTab: 'Open in new tab',
                close: 'Close',
                closeAria: 'Close',
                iframeTitle: 'Zaui booking',
            };

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
                {label}
            </button>

            {open ? (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/50"
                        aria-hidden="true"
                        onClick={() => setOpen(false)}
                    />

                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={dialogTitleId}
                            className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200"
                        >
                            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200">
                                <div className="min-w-0">
                                    <h2 id={dialogTitleId} className="text-lg font-bold text-gray-900 truncate">
                                        {ui.heading}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {ui.hint}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <a
                                        href={bookingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 rounded-md bg-[#f7941e] hover:bg-[#e68a1c] text-white font-semibold transition-colors"
                                    >
                                        {ui.openNewTab}
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-900 font-semibold transition-colors"
                                        aria-label={ui.closeAria}
                                    >
                                        {ui.close}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-50">
                                {open && (
                                    <iframe
                                        title={ui.iframeTitle}
                                        src={bookingUrl}
                                        className="w-full"
                                        style={{ height: '80vh' }}
                                        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
