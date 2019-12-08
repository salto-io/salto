import { EOL } from 'os'
import { Writable } from 'stream'

export const writeLine = (stream: Writable, s = ''): void => {
  stream.write(s)
  stream.write(EOL)
}

export const terminalWidth = (
  s: Writable
): number | undefined => (s as NodeJS.WriteStream)?.columns
