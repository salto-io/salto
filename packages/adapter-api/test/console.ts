import stream from 'stream'

export type MockWritableStream = NodeJS.WritableStream & { contents(): string }

export const mockConsoleStream = (supportsColor: boolean): MockWritableStream => {
  let contents = ''
  const writable = new stream.Writable({
    write: s => { contents += s },
  })
  return Object.assign(writable, {
    isTTY: supportsColor,
    getColorDepth(): number { return 16 },
    contents(): string { return contents },
  })
}
