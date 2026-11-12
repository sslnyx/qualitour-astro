import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPagesRebuildHandler,
  triggerPagesRebuild,
} from '../src/plugins/pages-rebuild/notifier.mjs';

const validPagesHookUrl =
  'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/opaque-hook_123';
const validWorkersHookUrl =
  'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/opaque-hook_456';

test('non-tour events do not read the credential or make a request', async () => {
  let requests = 0;
  const handler = createPagesRebuildHandler({
    getHookUrls() {
      throw new Error('credential should not be read');
    },
    fetchImpl: async () => {
      requests += 1;
      return new Response(null, { status: 204 });
    },
    logError() {
      assert.fail('non-tour events must not log a notifier failure');
    },
  });

  await handler({ collection: 'posts', content: { secret: validWorkersHookUrl } });

  assert.equal(requests, 0);
});

test('a tour event prefers the Workers Builds hook and sends an empty POST', async () => {
  const requests = [];
  const handler = createPagesRebuildHandler({
    getHookUrls: () => ({
      workersHookUrl: validWorkersHookUrl,
      pagesHookUrl: validPagesHookUrl,
    }),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(null, { status: 204 });
    },
    logError: assert.fail,
  });

  await handler({ collection: 'tours', content: { title: 'Must not be sent' } });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, validWorkersHookUrl);
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(requests[0].init.redirect, 'manual');
  assert.equal(requests[0].init.body, undefined);
});

test('the Pages hook is used only when the Workers Builds binding is absent', async () => {
  const requests = [];
  const handler = createPagesRebuildHandler({
    getHookUrls: () => ({
      workersHookUrl: undefined,
      pagesHookUrl: validPagesHookUrl,
    }),
    fetchImpl: async (url) => {
      requests.push(url);
      return new Response(null, { status: 204 });
    },
    logError: assert.fail,
  });

  await handler({ collection: 'tours' });

  assert.deepEqual(requests, [validPagesHookUrl]);
});

test('a malformed Workers Builds binding fails without falling back to Pages', async () => {
  const requests = [];
  const logs = [];
  const handler = createPagesRebuildHandler({
    getHookUrls: () => ({
      workersHookUrl: `${validWorkersHookUrl}?secret=do-not-log`,
      pagesHookUrl: validPagesHookUrl,
    }),
    fetchImpl: async (url) => {
      requests.push(url);
      return new Response(null, { status: 204 });
    },
    logError: (...args) => logs.push(args),
  });

  await handler({ collection: 'tours' });

  assert.deepEqual(requests, []);
  assert.deepEqual(logs, [['Public site rebuild notification failed']]);
  assert.equal(JSON.stringify(logs).includes('do-not-log'), false);
});

test('invalid hook URLs are rejected before a request without exposing the credential', async () => {
  const invalidConfigurations = [
    { workersHookUrl: 'http://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/secret-value' },
    { workersHookUrl: 'https://evil.example/client/v4/workers/builds/deploy_hooks/secret-value' },
    { workersHookUrl: 'https://api.cloudflare.com:8443/client/v4/workers/builds/deploy_hooks/secret-value' },
    { workersHookUrl: 'https://user:pass@api.cloudflare.com/client/v4/workers/builds/deploy_hooks/secret-value' },
    { workersHookUrl: 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/secret-value?leak=1' },
    { workersHookUrl: 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/secret-value#fragment' },
    { workersHookUrl: 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/secret-value/extra' },
    { workersHookUrl: 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/secret%2Fvalue' },
    { workersHookUrl: validPagesHookUrl },
    { workersHookUrl: undefined, pagesHookUrl: validWorkersHookUrl },
  ];

  for (const hookUrls of invalidConfigurations) {
    let requests = 0;
    await assert.rejects(
      triggerPagesRebuild({
        hookUrls,
        fetchImpl: async () => {
          requests += 1;
          return new Response(null, { status: 204 });
        },
      }),
      (error) => {
        assert.equal(error.message, 'Public site rebuild hook configuration is invalid');
        assert.equal(error.message.includes('secret-value'), false);
        return true;
      },
    );
    assert.equal(requests, 0);
  }
});

test('handler catches failures and logs only a fixed sanitized message', async () => {
  const logs = [];
  const credential = `${validWorkersHookUrl}-do-not-log`;
  const handler = createPagesRebuildHandler({
    getHookUrls: () => ({ workersHookUrl: credential, pagesHookUrl: validPagesHookUrl }),
    fetchImpl: async () => new Response('sensitive response body', { status: 401 }),
    logError: (...args) => logs.push(args),
  });

  await handler({ collection: 'tours', content: { credential } });

  assert.deepEqual(logs, [['Public site rebuild notification failed']]);
  assert.equal(JSON.stringify(logs).includes(credential), false);
  assert.equal(JSON.stringify(logs).includes('sensitive response body'), false);
});

test('only 2xx responses count as success', async () => {
  for (const status of [200, 204, 299]) {
    await assert.doesNotReject(
      triggerPagesRebuild({
        hookUrls: { workersHookUrl: validWorkersHookUrl },
        fetchImpl: async () => new Response(null, { status }),
      }),
    );
  }

  for (const status of [300, 400, 401]) {
    await assert.rejects(
      triggerPagesRebuild({
        hookUrls: { workersHookUrl: validWorkersHookUrl },
        fetchImpl: async () => new Response(null, { status }),
      }),
      { message: 'Public site rebuild request was rejected' },
    );
  }
});

test('transient responses and network errors retry once', async () => {
  for (const firstOutcome of [new Response(null, { status: 503 }), new Error('contains a secret')]) {
    let requests = 0;
    let sleeps = 0;
    await triggerPagesRebuild({
      hookUrls: { workersHookUrl: validWorkersHookUrl },
      fetchImpl: async () => {
        requests += 1;
        if (requests === 1) {
          if (firstOutcome instanceof Error) throw firstOutcome;
          return firstOutcome;
        }
        return new Response(null, { status: 202 });
      },
      sleepImpl: async () => {
        sleeps += 1;
      },
    });

    assert.equal(requests, 2);
    assert.equal(sleeps, 1);
  }
});

test('client errors and redirects are not retried', async () => {
  for (const status of [301, 400, 401, 403, 404]) {
    let requests = 0;
    await assert.rejects(
      triggerPagesRebuild({
        hookUrls: { workersHookUrl: validWorkersHookUrl },
        fetchImpl: async (_url, init) => {
          requests += 1;
          assert.equal(init.redirect, 'manual');
          return new Response(null, { status });
        },
        sleepImpl: async () => assert.fail('non-transient failures must not sleep'),
      }),
    );
    assert.equal(requests, 1);
  }
});

test('requests time out and the bounded retry finishes well within the hook timeout', async () => {
  let requests = 0;
  const startedAt = Date.now();

  await assert.rejects(
    triggerPagesRebuild({
      hookUrls: { workersHookUrl: validWorkersHookUrl },
      requestTimeoutMs: 10,
      retryDelayMs: 1,
      fetchImpl: async (_url, init) => {
        requests += 1;
        await new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('timeout with a secret')), {
            once: true,
          });
        });
      },
    }),
    { message: 'Public site rebuild request failed' },
  );

  assert.equal(requests, 2);
  assert.ok(Date.now() - startedAt < 1_000);
});
