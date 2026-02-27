/**
 * NewsletterForm - React island for the footer subscription form.
 *
 * Submits to POST /qualitour/v1/subscribe to create a WP subscriber user.
 */

import { useState } from "react";

interface NewsletterFormProps {
    lang: string;
    apiBase: string;
}

export default function NewsletterForm({ lang, apiBase }: NewsletterFormProps) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const t = {
        placeholder: lang === "zh" ? "輸入您的郵箱" : "Enter your email",
        subscribe: lang === "zh" ? "訂閱" : "Subscribe",
        subscribing: lang === "zh" ? "提交中..." : "Subscribing...",
        invalidEmail: lang === "zh" ? "請輸入有效的郵箱地址" : "Please enter a valid email",
        networkError: lang === "zh" ? "網絡錯誤，請稍後重試" : "Network error. Please try again.",
        success: lang === "zh" ? "感謝訂閱！" : "Thank you for subscribing!",
        alreadySubscribed: lang === "zh" ? "您已訂閱，感謝您！" : "You are already subscribed. Thank you!",
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setStatus("error");
            setMessage(t.invalidEmail);
            return;
        }

        setStatus("loading");
        setMessage("");

        try {
            const res = await fetch(`${apiBase}/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (res.ok && data.status === "success") {
                setStatus("success");
                setMessage(data.new === false ? t.alreadySubscribed : t.success);
                setEmail("");
            } else {
                setStatus("error");
                setMessage(data.message || t.networkError);
            }
        } catch {
            setStatus("error");
            setMessage(t.networkError);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {status === "success" ? (
                <div className="flex items-center gap-2 text-green-400 font-medium text-sm animate-fade-in">
                    <span className="material-icons text-lg">check_circle</span>
                    {message}
                </div>
            ) : (
                <>
                    <div className="relative w-full sm:w-72">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (status === "error") setStatus("idle");
                            }}
                            placeholder={t.placeholder}
                            disabled={status === "loading"}
                            className={`px-5 py-3 bg-gray-900/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all w-full disabled:opacity-60 ${status === "error" ? "border-red-500/50" : "border-white/10"
                                }`}
                        />
                        {status === "error" && message && (
                            <p className="text-red-400 text-xs mt-1 absolute -bottom-5 left-1">{message}</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-orange-500/25 disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                        {status === "loading" ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t.subscribing}
                            </>
                        ) : (
                            t.subscribe
                        )}
                    </button>
                </>
            )}
        </form>
    );
}
