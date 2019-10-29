import ora from 'ora'
import { Spinner, SpinnerCreator, SpinnerOptions } from './types'

export type Dependencies = {
  outputStream: NodeJS.WritableStream
}

const oraSpinnerCreator = (
  deps: Dependencies,
): SpinnerCreator => ({
  start(
    startText: string,
    { color, prefixText, hideCursor, indent }: SpinnerOptions
  ): Spinner {
    const oraSpinner = ora({
      stream: deps.outputStream,
      color,
      prefixText,
      hideCursor,
      indent,
    }).start(startText)
    return {
      succeed: (text: string): void => {
        oraSpinner.succeed(text)
      },
      fail: (text: string): void => {
        oraSpinner.fail(text)
      },
    }
  },
})

export default oraSpinnerCreator
