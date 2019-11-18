import { threadId } from 'worker_threads'
import { logger } from '@salto/logging'
import { AsyncHclParser } from './types'

// import { createInlineAsyncParser } from './go_parser'
import { createWorkerParser } from './worker'

export { AsyncHclParser } from './types'

const log = logger(module)

let isSingleThreaded = true

export const createParser = (): Promise<AsyncHclParser> => {
  log.debug('creating parser, pid=%o, threadId=%o isSingleThreaded=%s\n%s', process.pid, threadId, isSingleThreaded, (new Error()).stack)
  return createWorkerParser()
  // return isSingleThreaded
  //   ? createInlineAsyncParser()
  //   : createWorkerParser()
}

let parserPromise: Promise<AsyncHclParser> | undefined

export const stopParser = async (): Promise<void> => {
  if (parserPromise) {
    await (await parserPromise).stop()
    parserPromise = undefined
  }
}

export const setThreading = async (singleThreaded: boolean): Promise<void> => {
  isSingleThreaded = singleThreaded
  await stopParser()
  parserPromise = createParser()
}

const getParser = async (): Promise<AsyncHclParser> => {
  if (!parserPromise) {
    parserPromise = createParser()
  }
  return parserPromise
}

process.on('exit', () => {
  log.debug('exit, parserPromise=%o', parserPromise)
  stopParser()
})

process.on('beforeExit', () => {
  log.debug('beforeExit, parserPromise=%o', parserPromise)
  stopParser()
})

export default getParser
