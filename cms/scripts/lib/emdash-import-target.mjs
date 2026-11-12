const LOCAL_ORIGIN = 'http://127.0.0.1:4327';
const CLOUD_ORIGIN = 'https://qualitour-cms-free-test.qualitour.workers.dev';

const CLOUD_ACCOUNT_ID = 'ca4d347f96116e87e8f5dbd6c62f0b30';
const CLOUD_D1_ID = 'cf36703e-a507-4810-b865-9cd57f6681a8';
const CLOUD_R2_BUCKET = 'qualitour-cms-free-test-media';

const SPECS = {
  local: {
    kind: 'local',
    origin: LOCAL_ORIGIN,
    protocol: 'http:',
    hostname: '127.0.0.1',
    port: '4327',
    statePath: '.astro/emdash-full-import.json',
    lockPath: '.astro/emdash-full-import.lock',
    reportPrefix: '.astro/emdash-full-import',
    identity: Object.freeze({ kind: 'local', origin: LOCAL_ORIGIN }),
  },
  'cloud-free': {
    kind: 'cloud-free',
    origin: CLOUD_ORIGIN,
    protocol: 'https:',
    hostname: 'qualitour-cms-free-test.qualitour.workers.dev',
    port: '',
    statePath: '.astro/emdash-cloud-full-import.json',
    lockPath: '.astro/emdash-cloud-full-import.lock',
    reportPrefix: '.astro/emdash-cloud-full-import',
    identity: Object.freeze({
      kind: 'cloud-free',
      origin: CLOUD_ORIGIN,
      accountId: CLOUD_ACCOUNT_ID,
      d1Id: CLOUD_D1_ID,
      r2Bucket: CLOUD_R2_BUCKET,
    }),
  },
};

function fail(message) {
  throw new TypeError(message);
}

export function resolveImportTarget({ target = 'local', base } = {}) {
  if (target !== 'local' && target !== 'cloud-free') {
    fail(`unknown import target: ${String(target)}`);
  }
  const spec = SPECS[target];

  let url;
  if (base === undefined) {
    url = new URL(spec.origin);
  } else if (base instanceof URL) {
    url = new URL(base.href);
  } else if (typeof base === 'string') {
    try {
      url = new URL(base);
    } catch {
      fail(`invalid base URL for target "${target}"`);
    }
  } else {
    fail('base must be a string or URL');
  }

  if (url.username !== '' || url.password !== '') {
    fail('base URL must not contain credentials');
  }
  if (url.protocol !== spec.protocol) {
    fail(`base URL protocol must be ${spec.protocol} for target "${target}"`);
  }
  if (url.hostname !== spec.hostname) {
    fail(`base URL host must be ${spec.hostname} for target "${target}"`);
  }
  if (url.port !== spec.port) {
    fail(`base URL port must be ${spec.port || '(default)'} for target "${target}"`);
  }
  if (url.pathname !== '/') {
    fail('base URL path must be "/"');
  }
  if (url.search !== '') {
    fail('base URL must not contain a query string');
  }
  if (url.hash !== '') {
    fail('base URL must not contain a hash');
  }
  if (url.origin !== spec.origin) {
    fail(`base URL origin must be ${spec.origin} for target "${target}"`);
  }

  const identity = Object.freeze({ ...spec.identity });
  return Object.freeze({
    base: url,
    kind: spec.kind,
    origin: spec.origin,
    statePath: spec.statePath,
    lockPath: spec.lockPath,
    reportPrefix: spec.reportPrefix,
    identity,
  });
}

export function assertJournalTarget(journal, target) {
  if (!target || typeof target !== 'object' || !target.identity || typeof target.identity !== 'object') {
    fail('target must be a resolveImportTarget result');
  }
  if (!journal || typeof journal !== 'object') {
    fail('journal target identity is absent');
  }
  const actual = journal.target;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    fail('journal target identity is absent');
  }
  const expected = target.identity;
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  if (actualKeys.length !== expectedKeys.length) {
    fail('journal target identity does not match target');
  }
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(actual, key) || actual[key] !== expected[key]) {
      fail('journal target identity does not match target');
    }
  }
  return true;
}

export function assertActiveDeployment(deployments, expectedVersion) {
  if (!Array.isArray(deployments) || !deployments.length) fail('Active deployment could not be verified');
  if (deployments.some(x => !Number.isFinite(Date.parse(x.created_on)))) fail('Invalid deployment timestamps');
  const latest = deployments.reduce((a, b) => Date.parse(a.created_on) > Date.parse(b.created_on) ? a : b);
  if (latest.versions?.length !== 1 || latest.versions[0].version_id !== expectedVersion || latest.versions[0].percentage !== 100) {
    fail('Cloud Worker deployment changed since the Free CPU gate; verify the new version before importing');
  }
  return true;
}
