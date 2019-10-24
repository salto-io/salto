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
    initalConfig = mergeConfigs() // get a copy of the default config
    consoleStream = mockConsoleStream(true)
  })

  let logger: Logger
  let line: string

  const logLine = (level: LogLevel = 'error'): void => {
    logger[level]('hello %o', { world: true }, { extra: 'stuff' })
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
          expect(line).toContain('error')
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('hello { world: true }')
        })

        it('should colorize the line', () => {
          expect(line).toContain('\u001b[38')
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
      describe('when it returns true', () => {
        beforeEach(() => {
          logger = createLogger()
          logLine()
        })

        it('should write the message to the console stream', () => {
          expect(line).not.toHaveLength(0)
        })
      })

      describe('when it returns false', () => {
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
        logLine('debug')
      })

      it('updates the logger in place', () => {
        expect(line).not.toHaveLength(0)
      })
    })
  })

  let jsonLine: { [key: string]: unknown }

  describe('logging errors', () => {
    let error: Error

    beforeEach(() => {
      error = new Error('testing 123')
    })

    describe('when format is "text"', () => {
      let line1: string
      let line2: string

      beforeEach(() => {
        logger = createLogger()
        logger.log('warn', error);
        [line1, line2] = consoleStream.contents().split('\n')
      })

      it('should log the error message and stack in multiple lines', () => {
        expect(line1).toContain('Error: testing 123') // message
        expect(line2).toContain(' at ') // stack
      })
    })

    describe('when format is "json"', () => {
      beforeEach(() => {
        logger = createLogger()
        logger.configure({ format: 'json' })
        logger.log('warn', error)
        const [line1] = consoleStream.contents().split('\n')
        jsonLine = JSON.parse(line1)
      })

      it('should log the error message and stack as JSON on a single line', () => {
        expect(jsonLine.timestamp).toMatch(TIMESTAMP_REGEX)
        expect(jsonLine.level).toEqual('warn')
        expect(jsonLine.message).toEqual('Error: testing 123')
        expect(jsonLine.stack).toEqual(error.stack)
      })

      it('should log only the expected properties', () => {
        expect(Object.keys(jsonLine).sort()).toEqual([
          'level', 'message', 'namespace', 'stack', 'timestamp',
        ])
      })
    })
  })

  describe('JSON format', () => {
    beforeEach(() => {
      logger = createLogger()
      logger.configure({ format: 'json' })
      logLine('warn')
      jsonLine = JSON.parse(line)
    })

    it('should log the error message and stack as JSON on a single line', () => {
      expect(jsonLine.timestamp).toMatch(TIMESTAMP_REGEX)
      expect(jsonLine.level).toEqual('warn')
      expect(jsonLine.message).toEqual('hello { world: true }')
      expect(jsonLine.extra).toEqual('stuff')
    })

    it('should log only the expected properties', () => {
      expect(Object.keys(jsonLine).sort()).toEqual([
        'extra', 'level', 'message', 'namespace', 'timestamp',
      ])
    })

    it('should not colorize the line', () => {
      expect(line).not.toContain('\u001b[38')
    })
  })
})
