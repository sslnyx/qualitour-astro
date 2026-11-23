const intervals = [5_000, 10_000, 20_000, 30_000];
const windowMs = 120_000;

/** Check a pending payment while the page is visible, until the check says to stop. */
export function pollPendingPayment(check: () => Promise<boolean>) {
  const deadline = Date.now() + windowMs;
  let step = 0;
  let timer: number | undefined;
  let checking = false;
  let stopped = false;

  function stop() {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", schedule);
  }

  function schedule() {
    window.clearTimeout(timer);
    if (stopped || checking || document.visibilityState !== "visible") return;
    const delay = intervals[Math.min(step, intervals.length - 1)];
    if (Date.now() + delay >= deadline) {
      stop();
      return;
    }
    timer = window.setTimeout(run, delay);
  }

  async function run() {
    if (stopped || document.visibilityState !== "visible") return;
    if (Date.now() >= deadline) {
      stop();
      return;
    }
    checking = true;
    step++;
    try {
      if (!(await check())) stop();
    } catch {
      stop();
    } finally {
      checking = false;
      schedule();
    }
  }

  document.addEventListener("visibilitychange", schedule);
  schedule();
  return stop;
}
