import stream from 'stream'

export type MockWritableStream = NodeJS.WritableStream & {
  contents(): string
  supportsColor: boolean
}

export const mockConsoleStream = (supportsColor: boolean): MockWritableStream => {
  let contents = ''
  const writable = new stream.Writable({
    write: s => { contents += s },
  })

  return Object.assign(writable, {
    supportsColor,
    isTTY: true,
    getColorDepth(): number {
      return this.supportsColor ? 16 : 0
    },
    contents(): string { return contents },
  })
}
