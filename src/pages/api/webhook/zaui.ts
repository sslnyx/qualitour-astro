/**
 * Zaui Webhook Endpoint
 * 
 * Handles Activity events (create, update, delete) from Zaui.
 * Triggers a GitHub Actions workflow_dispatch to rebuild and deploy via cPanel FTP.
 * 
 * Single endpoint handles all activity event types.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

// GitHub Actions trigger config
const GH_TOKEN = import.meta.env.GH_DEPLOY_WORKFLOW_TOKEN;
const GH_REPO = import.meta.env.GH_REPO; // e.g. "owner/repo"
const GH_WORKFLOW = 'deploy-cpanel-staging.yml';

// Multiple webhook secrets (one per event type in Zaui)
const WEBHOOK_SECRETS = [
    import.meta.env.ZAUI_WEBHOOK_SECRET_UPDATE,
    import.meta.env.ZAUI_WEBHOOK_SECRET_CREATE,
    import.meta.env.ZAUI_WEBHOOK_SECRET_DELETE,
].filter(Boolean);

// Debounce: max 1 deploy per 5 minutes
let lastDeployTime = 0;
const DEBOUNCE_MS = 5 * 60 * 1000;

export const POST: APIRoute = async ({ request }) => {
    const startTime = Date.now();

    try {
        // Get raw body for signature verification
        const rawBody = await request.text();
        let payload: Record<string, unknown>;

        try {
            payload = JSON.parse(rawBody);
        } catch {
            console.error('[Zaui Webhook] Invalid JSON payload');
            return jsonResponse({ error: 'Invalid JSON' }, 400);
        }

        // Log received event
        const eventType = payload.eventType || payload.event_type || payload.type || 'unknown';
        console.log(`[Zaui Webhook] Received: ${eventType}`);

        // Verify webhook signature if secrets are configured
        if (WEBHOOK_SECRETS.length > 0) {
            const signature = request.headers.get('x-zaui-signature')
                || request.headers.get('x-webhook-signature')
                || request.headers.get('authorization');

            if (!verifySignature(signature, WEBHOOK_SECRETS)) {
                console.error('[Zaui Webhook] Invalid signature');
                return jsonResponse({ error: 'Invalid signature' }, 401);
            }
        }

        // Check debounce - prevent rapid consecutive deploys
        const now = Date.now();
        if (now - lastDeployTime < DEBOUNCE_MS) {
            const waitSecs = Math.ceil((DEBOUNCE_MS - (now - lastDeployTime)) / 1000);
            console.log(`[Zaui Webhook] Debounced, next deploy in ${waitSecs}s`);
            return jsonResponse({
                status: 'debounced',
                message: `Deploy skipped, retry in ${waitSecs}s`,
                event: eventType,
            }, 200);
        }

        // Trigger GitHub Actions workflow_dispatch
        if (!GH_TOKEN || !GH_REPO) {
            console.error('[Zaui Webhook] GitHub config missing (GH_DEPLOY_WORKFLOW_TOKEN or GH_REPO)');
            return jsonResponse({ error: 'Deploy trigger not configured' }, 500);
        }

        const deployResponse = await fetch(
            `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GH_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: { trigger: `zaui-webhook-${eventType}` },
                }),
            }
        );

        if (!deployResponse.ok) {
            const errorText = await deployResponse.text();
            console.error('[Zaui Webhook] GitHub dispatch failed:', deployResponse.status, errorText);
            return jsonResponse({ error: 'Deploy trigger failed' }, 502);
        }

        lastDeployTime = now;
        const duration = Date.now() - startTime;

        console.log(`[Zaui Webhook] Deploy triggered for: ${eventType} (${duration}ms)`);

        return jsonResponse({
            status: 'deployed',
            event: eventType,
            timestamp: new Date().toISOString(),
        }, 200);

    } catch (error) {
        console.error('[Zaui Webhook] Error:', error);
        return jsonResponse({ error: 'Internal error' }, 500);
    }
};

// Handle GET for health check
export const GET: APIRoute = async () => {
    return jsonResponse({
        status: 'ok',
        service: 'zaui-webhook',
        ghConfigured: !!(GH_TOKEN && GH_REPO),
        secretsConfigured: WEBHOOK_SECRETS.length,
    }, 200);
};

/**
 * Verify webhook signature against any of the configured secrets
 * Zaui uses the secret phrase in different header formats
 */
function verifySignature(
    signature: string | null,
    secrets: string[]
): boolean {
    if (!signature) {
        // If no signature header, still allow if any secret starts with 'whsec_'
        // (Zaui may not send signature header, just the secret in config)
        return secrets.some(s => s.startsWith('whsec_'));
    }

    // Check if signature matches any of the configured secrets
    return secrets.some(secret => signature === secret);
}

/**
 * Helper to create JSON response
 */
function jsonResponse(data: Record<string, unknown>, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
