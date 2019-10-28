import ora from 'ora'
import { Spinner, SpinnerCreator, SpinnerOptions } from './types'

export type Dependencies = {
  outputStream: NodeJS.WritableStream
}

const oraSpinnerCreator = (
  deps: Dependencies,
): SpinnerCreator => ({ color, prefixText, hideCursor, indent }: SpinnerOptions): Spinner => {
  const oraSpinner = ora({
    stream: deps.outputStream,
    color,
    prefixText,
    hideCursor,
    indent,
  })
  return {
    start: (text: string): Spinner => oraSpinner.start(text) as Spinner,
    succeed: (text: string): Spinner => oraSpinner.succeed(text) as Spinner,
    fail: (text: string): Spinner => oraSpinner.fail(text) as Spinner,
  }
}

export default oraSpinnerCreator
