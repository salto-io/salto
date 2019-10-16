import fs from 'fs'
import tmp from 'tmp'
import { pollPromise } from '../../poll'
import { mockConsoleStream, MockWritableStream } from '../../console'
import {
  BasicLogger, LogLevel, Config, mergeConfigs,
} from '../../../src/logging/internal/common'
import { createLogger as createWinstonLogger } from '../../../src/logging/internal/winston'

const TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/

describe('winston', () => {
  let consoleStream: MockWritableStream
  let config: Config
  const NAMESPACE = 'my namespace'

  beforeEach(() => {
    config = mergeConfigs()
    consoleStream = mockConsoleStream(true)
  })

  let logger: BasicLogger
  let line: string

  const logLine = (level: LogLevel = 'error'): void => {
    logger = createWinstonLogger({ consoleStream }, config, NAMESPACE)
    logger.log(level, 'hello %o', { world: true }, { extra: 'stuff' })
    logger.end();
    [line] = consoleStream.contents().split('\n')
  }

  describe('configured filename', () => {
    describe('when set', () => {
      jest.setTimeout(200)

      let filename: string

      const readFileContent = (): string => fs.readFileSync(filename, { encoding: 'utf8' })

      beforeEach(async () => {
        filename = tmp.tmpNameSync({ postfix: '.log' })
        config.filename = filename
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

  describe('configured minLevel', () => {
    beforeEach(() => {
      config.minLevel = 'info'
    })

    describe('when logging at the configured level', () => {
      beforeEach(() => {
        logLine(config.minLevel)
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

  // describe('configured enabledForNamespace', () => {
  //   describe('when set to "all"', () => {
  //     beforeEach(() => {
  //       logLine()
  //     })

  //     it('should write the message to the console stream', () => {
  //       expect(line).not.toHaveLength(0)
  //     })
  //   })

  //   describe('when set to "none"', () => {
  //     beforeEach(() => {
  //       config.enabledForNamespace = () => false
  //       logLine()
  //     })

  //     it('should not write the message to the console stream', () => {
  //       expect(line).toHaveLength(0)
  //     })
  //   })
  // })
})
