import { AsyncHclParser } from './types'
import { createInlineAsyncParser } from './go_parser'
import { createParserWorker } from './worker'

export { AsyncHclParser } from './types'

let isSingleThreaded = true

export const createParser = (): Promise<AsyncHclParser> => (
  isSingleThreaded
    ? createInlineAsyncParser()
    : createParserWorker()
)

let parser: AsyncHclParser

export const stopParser = async (): Promise<void> => {
  if (parser) {
    await parser.stop()
  }
}

export const setThreading = async (singleThreaded: boolean): Promise<void> => {
  isSingleThreaded = singleThreaded
  await stopParser()
  parser = await createParser()
}

const getParser = async (): Promise<AsyncHclParser> => {
  if (!parser) {
    parser = await createParser()
  }
  return parser
}

export default getParser
