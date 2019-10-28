const toContainColors: (
  received?: unknown
) => { message(): string; pass: boolean } = received => (
  typeof received === 'string' && received.includes('\u001b[')
    ? { pass: true, message: () => `expected "${received}" not to contain colors` }
    : { pass: false, message: () => `expected "${received} to contain colors` }
)

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace jest {
  interface Matchers<R> {
    toContainColors: typeof toContainColors
  }
}

expect.extend({ toContainColors })
