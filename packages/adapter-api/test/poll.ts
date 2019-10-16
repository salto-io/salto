export const DEFAULT_POLL_INTERVAL = 10

export const poll = (
  predicate: () => boolean, interval = DEFAULT_POLL_INTERVAL, done: () => void
): void => {
  if (predicate()) {
    done()
  } else {
    setTimeout(() => poll(predicate, interval, done), interval)
  }
}

export const pollPromise = (
  predicate: () => boolean, interval = DEFAULT_POLL_INTERVAL
): Promise<void> => new Promise(resolve => poll(predicate, interval, resolve))
