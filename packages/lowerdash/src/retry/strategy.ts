// The return type determines the next retry action:
// * number: wait this duration then retry
// * string: no more retries, a WaitError is thrown with this message
export type RetryStrategy = () => number | string
