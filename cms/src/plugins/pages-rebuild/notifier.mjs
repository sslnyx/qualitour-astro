const REQUEST_TIMEOUT_MS = 2_000;
const RETRY_DELAY_MS = 250;
const MAX_ATTEMPTS = 2;

const CONFIGURATION_ERROR = 'Public site rebuild hook configuration is invalid';
const REJECTED_ERROR = 'Public site rebuild request was rejected';
const REQUEST_ERROR = 'Public site rebuild request failed';
const LOG_MESSAGE = 'Public site rebuild notification failed';

const WORKERS_HOOK_PATH = /^\/client\/v4\/workers\/builds\/deploy_hooks\/[A-Za-z0-9_-]+$/;
const PAGES_HOOK_PATH = /^\/client\/v4\/pages\/webhooks\/deploy_hooks\/[A-Za-z0-9_-]+$/;

class NonRetryableRequestError extends Error {}

function parseHookUrl(value, validPath) {
  if (typeof value !== 'string') throw new Error(CONFIGURATION_ERROR);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(CONFIGURATION_ERROR);
  }

  if (
    url.protocol !== 'https:' ||
    url.host !== 'api.cloudflare.com' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    !validPath.test(url.pathname)
  ) {
    throw new Error(CONFIGURATION_ERROR);
  }

  return url.href;
}

function selectHookUrl(hookUrls) {
  if (!hookUrls || typeof hookUrls !== 'object') throw new Error(CONFIGURATION_ERROR);

  if (hookUrls.workersHookUrl !== undefined) {
    return parseHookUrl(hookUrls.workersHookUrl, WORKERS_HOOK_PATH);
  }

  return parseHookUrl(hookUrls.pagesHookUrl, PAGES_HOOK_PATH);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithTimeout(fetchImpl, url, requestTimeoutMs) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(REQUEST_ERROR));
    }, requestTimeoutMs);
  });

  try {
    return await Promise.race([
      fetchImpl(url, {
        method: 'POST',
        redirect: 'manual',
        signal: controller.signal,
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function isTransientStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Trigger the preferred Cloudflare Workers Builds deploy hook, with a
 * transitional Pages deploy-hook fallback only when the Workers binding is
 * absent.
 *
 * The injected functions keep this module runnable without Workers bindings.
 *
 * @param {{
 *   hookUrls: { workersHookUrl?: unknown, pagesHookUrl?: unknown },
 *   fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
 *   sleepImpl?: (milliseconds: number) => Promise<void>,
 *   requestTimeoutMs?: number,
 *   retryDelayMs?: number,
 * }} options
 */
export async function triggerPagesRebuild({
  hookUrls,
  fetchImpl,
  sleepImpl = sleep,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
  retryDelayMs = RETRY_DELAY_MS,
}) {
  const url = selectHookUrl(hookUrls);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, url, requestTimeoutMs);
      if (response.status >= 200 && response.status < 300) return;

      if (!isTransientStatus(response.status)) {
        throw new NonRetryableRequestError(REJECTED_ERROR);
      }
    } catch (error) {
      if (error instanceof NonRetryableRequestError) throw error;
    }

    if (attempt < MAX_ATTEMPTS) await sleepImpl(retryDelayMs);
  }

  throw new Error(REQUEST_ERROR);
}

/**
 * Create a publication-safe hook handler. Failures are reduced to one fixed
 * message and never escape into the CMS publication flow.
 *
 * @param {{
 *   getHookUrls: () => { workersHookUrl?: unknown, pagesHookUrl?: unknown },
 *   fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
 *   logError: (message: string) => void,
 *   sleepImpl?: (milliseconds: number) => Promise<void>,
 *   requestTimeoutMs?: number,
 *   retryDelayMs?: number,
 * }} options
 */
export function createPagesRebuildHandler({
  getHookUrls,
  fetchImpl,
  logError,
  sleepImpl,
  requestTimeoutMs,
  retryDelayMs,
}) {
  /** @param {{ collection: string }} event */
  return async function handlePagesRebuild(event) {
    if (event.collection !== 'tours') return;

    try {
      await triggerPagesRebuild({
        hookUrls: getHookUrls(),
        fetchImpl,
        sleepImpl,
        requestTimeoutMs,
        retryDelayMs,
      });
    } catch {
      try {
        logError(LOG_MESSAGE);
      } catch {
        // A logger failure must not turn a successful CMS mutation into an error.
      }
    }
  };
}
