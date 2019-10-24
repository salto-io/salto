import fs from 'fs'
import tmp from 'tmp'
import { pollPromise } from '../../poll'
import { mockConsoleStream, MockWritableStream } from '../../console'
import {
  LogLevel, Config, mergeConfigs,
} from '../../../src/logging/internal/common'
import { createLogger as createWinstonLogger } from '../../../src/logging/internal/winston'
import { loggerFromBasicLogger, Logger } from '../../../src/logging/internal/logger'

const TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/

describe('winston logger', () => {
  let consoleStream: MockWritableStream
  let initalConfig: Config
  const NAMESPACE = 'my-namespace'

  const createLogger = (): Logger => {
    const basicLogger = createWinstonLogger({ consoleStream }, initalConfig, NAMESPACE)
    return loggerFromBasicLogger(basicLogger, initalConfig, NAMESPACE)
  }

  beforeEach(() => {
    initalConfig = mergeConfigs()
    consoleStream = mockConsoleStream(true)
  })

  let logger: Logger
  let line: string

  const logLine = (level: LogLevel = 'error'): void => {
    logger.log(level, 'hello %o', { world: true }, { extra: 'stuff' })
    logger.end();
    [line] = consoleStream.contents().split('\n')
  }

  describe('initial configuration', () => {
    describe('filename', () => {
      describe('when set', () => {
        jest.setTimeout(200)

        let filename: string

        const readFileContent = (): string => fs.readFileSync(filename, { encoding: 'utf8' })

        beforeEach(async () => {
          filename = tmp.tmpNameSync({ postfix: '.log' })
          initalConfig.filename = filename
          logger = createLogger()
          logLine()

          // Polling abomination is here since the feature in winston that waits for logging is
          // broken. Tried and failed:
          // - Passing a callback to winstonLogger.log() - not called
          // - logger.impl.on('finish', done), logger.impl.end(done) - done called too soon
          await pollPromise(
            // can't just poll for existence since it may be created and empty
            () => fs.existsSync(filename) && readFileContent() !== '',
          )
          const fileContents = readFileContent();
          [line] = fileContents.split('\n')
        })

        afterEach(() => {
          fs.unlinkSync(filename)
        })

        it('should write the message to the file', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(`error ${NAMESPACE} hello { world: true }`)
        })
      })

      describe('when not set', () => {
        beforeEach(() => {
          logger = createLogger()
          logLine()
        })

        it('should write the message to the console stream', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain('\u001b[38') // color
          expect(line).toContain('error')
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('hello { world: true }')
        })
      })
    })

    describe('minLevel', () => {
      beforeEach(() => {
        initalConfig.minLevel = 'info'
        logger = createLogger()
      })

      describe('when logging at the configured level', () => {
        beforeEach(() => {
          logLine(initalConfig.minLevel)
        })

        it('should write the message to the console stream', () => {
          expect(line).not.toHaveLength(0)
        })
      })

      describe('when logging above the configured level', () => {
        beforeEach(() => {
          logLine('error')
        })

        it('should write the message to the console stream', () => {
          expect(line).not.toHaveLength(0)
        })
      })

      describe('when logging below the configured level', () => {
        beforeEach(() => {
          logLine('debug')
        })

        it('should not write the message to the console stream', () => {
          expect(line).toHaveLength(0)
        })
      })
    })

    describe('enabledForNamespace', () => {
      describe('when set to "all"', () => {
        beforeEach(() => {
          logger = createLogger()
          logLine()
        })

        it('should write the message to the console stream', () => {
          expect(line).not.toHaveLength(0)
        })
      })

      describe('when set to "none"', () => {
        beforeEach(() => {
          initalConfig.enabledForNamespace = () => false
          logger = createLogger()
          logLine()
        })

        it('should not write the message to the console stream', () => {
          expect(line).toHaveLength(0)
        })
      })
    })
  })

  describe('child', () => {
    const CHILD_NAMESPACE = 'child-namespace'

    describe('when created with a string namespace arg', () => {
      beforeEach(() => {
        logger = createLogger().child(CHILD_NAMESPACE)
        logLine()
      })

      it('writes the message with the concatenated namespace', () => {
        expect(line).toContain(`${NAMESPACE}.${CHILD_NAMESPACE}`)
      })
    })

    describe('when created with a module namespace arg', () => {
      beforeEach(() => {
        logger = createLogger().child(module)
        logLine()
      })

      it('writes the message with the child namespace as string', () => {
        expect(line).toContain('adapter-api/logging/internal/winston.test')
      })
    })
  })

  describe('configure', () => {
    beforeEach(() => {
      logger = createLogger()
    })

    describe('when a partial config is specified', () => {
      beforeEach(() => {
        logger.configure({ minLevel: 'debug' })
        logger.log('debug', 'hello %o', { world: true }, { extra: 'stuff' });
        [line] = consoleStream.contents().split('\n')
      })

      it('updates the logger in place', () => {
        expect(line).not.toHaveLength(0)
      })
    })
  })
})
