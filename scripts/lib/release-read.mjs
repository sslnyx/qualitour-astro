import { setTimeout as delay } from 'node:timers/promises';

const transientCodes = new Set([
  'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET',
]);

// The operation must consume the response body before returning, since a socket can break after the headers arrive.
export async function readForRelease(path, read, retryDelays = [750, 2000, 5000]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      const code = error.cause?.code ?? error.code;
      if (error.name !== 'TimeoutError' && !transientCodes.has(code)) throw error;
      if (attempt === retryDelays.length) {
        throw new Error(`Release read failed for ${path} after ${attempt + 1} attempts`, { cause: error });
      }
      console.warn(`[release-site] Retrying ${path} after ${code ?? error.name}`);
      await delay(retryDelays[attempt]);
    }
  }
}
