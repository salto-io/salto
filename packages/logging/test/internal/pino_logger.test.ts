/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import * as fs from 'fs'
import * as tmp from 'tmp-promise'
import { EOL } from 'os'
import { mockConsoleStream, MockWritableStream } from '../console'
import { LogLevel, LOG_LEVELS } from '../../src/internal/level'
import { Config, mergeConfigs } from '../../src/internal/config'
import { loggerRepo, Logger, LoggerRepo } from '../../src/internal/logger'
import { loggerRepo as pinoLoggerRepo } from '../../src/internal/pino'
import '../matchers'

const TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/

describe('pino based logger', () => {
  let consoleStream: MockWritableStream
  let initialConfig: Config
  const NAMESPACE = 'my-namespace'
  let repo: LoggerRepo

  const createRepo = (): LoggerRepo => loggerRepo(
    pinoLoggerRepo({ consoleStream }, initialConfig),
    initialConfig,
  )

  const createLogger = (): Logger => {
    repo = createRepo()
    return repo(NAMESPACE)
  }

  beforeEach(() => {
    initialConfig = mergeConfigs({ minLevel: 'warn' })
    consoleStream = mockConsoleStream(true)
  })

  let logger: Logger
  let line: string

  const logLine = async (
    { level = 'error', logger: l = logger }: { level?: LogLevel; logger?: Logger } = {},
  ): Promise<void> => {
    l[level]('hello %o', { world: true })
    await repo.end();
    [line] = consoleStream.contents().split(EOL)
  }
  describe('sanity', () => {
    beforeEach(() => {
      logger = createLogger()
      logger.warn('hello world')
    })

    afterEach(() => repo.end())

    it('logs', () => {
      expect(consoleStream.contents()).toContain('hello world')
    })
  })
  describe('initial configuration', () => {
    describe('filename', () => {
      describe('when set', () => {
        jest.setTimeout(600)

        let filename: string
        let line2: string

        const readFileContent = (): string => fs.readFileSync(filename, { encoding: 'utf8' })

        beforeEach(async () => {
          filename = tmp.tmpNameSync({ postfix: '.log' })
          initialConfig.filename = filename
          logger = createLogger()
          logger.error('hello1 %o', { world: true }, { extra: 'stuff' })
          logger.warn('hello2 %o', { world: true }, { extra: 'stuff' })
          await repo.end()
          const fileContents = readFileContent();
          [line, line2] = fileContents.split(EOL)
        })

        afterEach(() => {
          fs.unlinkSync(filename)
        })

        it('should write the message to the file', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(`error ${NAMESPACE} extra="stuff" hello1 { world: true }`)
        })

        it('should write the second message after a newline', () => {
          expect(line2).toMatch(TIMESTAMP_REGEX)
          expect(line2).toContain(`warn ${NAMESPACE} extra="stuff" hello2 { world: true }`)
        })

        it('should append to file on subsequent runs', async () => {
          logger = createLogger()
          logger.error('2nd run')
          await repo.end()

          const fileContents2 = readFileContent()
          const lines = fileContents2.split(EOL)
          expect(lines[0]).toEqual(line)
          expect(lines[1]).toEqual(line2)
          expect(lines[2]).toContain('2nd run')
        })
      })

      describe('when not set', () => {
        let line2: string

        beforeEach(async () => {
          logger = createLogger()
          logger.error('hello1 %o', { world: true }, { extra: 'stuff' })
          logger.warn('hello2 %o', { world: true }, { extra: 'stuff' })
          await repo.end();
          [line, line2] = consoleStream.contents().split(EOL)
        })

        it('should write the first message to the console stream', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain('error')
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('hello1 { world: true }')
        })

        it('should write the second message to the console stream', () => {
          expect(line2).toMatch(TIMESTAMP_REGEX)
          expect(line2).toContain('warn')
          expect(line2).toContain(NAMESPACE)
          expect(line2).toContain('hello2 { world: true }')
        })

        it('should colorize the line', () => {
          expect(line).toContainColors('\u001b[')
        })
      })
    })

    describe('minLevel', () => {
      describe('logging levels', () => {
        beforeEach(() => {
          initialConfig.minLevel = 'info'
          logger = createLogger()
        })

        describe('when logging at the configured level', () => {
          beforeEach(async () => {
            await logLine({ level: initialConfig.minLevel as LogLevel })
          })

          it('should write the message to the console stream', () => {
            expect(line).not.toHaveLength(0)
          })
        })

        describe('when logging above the configured level', () => {
          beforeEach(async () => {
            await logLine({ level: 'error' })
          })

          it('should write the message to the console stream', () => {
            expect(line).not.toHaveLength(0)
          })
        })

        describe('when logging below the configured level', () => {
          beforeEach(async () => {
            await logLine({ level: 'debug' })
          })

          it('should not write the message to the console stream', () => {
            expect(line).toHaveLength(0)
          })
        })
      })

      describe('"none"', () => {
        beforeEach(() => {
          initialConfig.minLevel = 'none'
          logger = createLogger()
        })

        LOG_LEVELS.forEach(level => {
          describe(`when logging at level ${level}`, () => {
            beforeEach(async () => {
              await logLine({ level })
            })

            it('should not write the message to the console stream', () => {
              expect(line).toHaveLength(0)
            })
          })
        })
      })
    })

    describe('namespaceFilter', () => {
      describe('as a function', () => {
        describe('when it returns true', () => {
          beforeEach(async () => {
            initialConfig.namespaceFilter = () => true
            logger = createLogger()
            await logLine()
          })

          it('should write the message to the console stream', () => {
            expect(line).not.toHaveLength(0)
          })
        })

        describe('when it returns false', () => {
          beforeEach(async () => {
            initialConfig.namespaceFilter = () => false
            logger = createLogger()
            await logLine()
          })

          it('should not write the message to the console stream', () => {
            expect(line).toHaveLength(0)
          })
        })
      })

      describe('as a string', () => {
        describe('when it is "*"', () => {
          beforeEach(async () => {
            initialConfig.namespaceFilter = '*'
            logger = createLogger()
            await logLine()
          })

          it('should write the message to the console stream', () => {
            expect(line).not.toHaveLength(0)
          })
        })

        describe('when it is another namespace', () => {
          beforeEach(async () => {
            initialConfig.namespaceFilter = 'other-namespace'
            logger = createLogger()
            await logLine()
          })

          it('should not write the message to the console stream', () => {
            expect(line).toHaveLength(0)
          })
        })

        describe('when it is a glob matching the namespace', () => {
          beforeEach(async () => {
            initialConfig.namespaceFilter = `${NAMESPACE}**`
            logger = createLogger()
            await logLine()
          })

          it('should write the message to the console stream', () => {
            expect(line).not.toHaveLength(0)
          })
        })
      })
    })

    describe('colorize', () => {
      describe('when it is set to true', () => {
        beforeEach(() => {
          initialConfig.colorize = true
        })

        describe('when the console supports color', () => {
          beforeEach(async () => {
            logger = createLogger()
            await logLine()
          })

          it('should colorize the line', () => {
            expect(line).toContainColors()
          })
        })

        describe('when the console does not support color', () => {
          beforeEach(async () => {
            consoleStream.supportsColor = false
            logger = createLogger()
            await logLine()
          })

          it('should still colorize the line', () => {
            expect(line).toContainColors()
          })
        })
      })

      describe('when it is set to false', () => {
        beforeEach(() => {
          initialConfig.colorize = false
        })

        describe('when the console supports color', () => {
          beforeEach(async () => {
            logger = createLogger()
            await logLine()
          })

          it('should not colorize the line', () => {
            expect(line).not.toContainColors()
          })
        })

        describe('when the console does not support color', () => {
          beforeEach(async () => {
            consoleStream.supportsColor = false
            logger = createLogger()
            await logLine()
          })

          it('should not colorize the line', () => {
            expect(line).not.toContainColors()
          })
        })
      })

      describe('when it is set to null', () => {
        describe('when the console does not have a getColorDepth function', () => {
          beforeEach(async () => {
            consoleStream.supportsColor = true
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (consoleStream as any).getColorDepth
            logger = createLogger()
            await logLine()
          })

          it('should not colorize the line', () => {
            expect(line).not.toContainColors()
          })
        })
      })
    })

    describe('globalTags', () => {
      const logTags = { number: 1, string: '1', bool: true }

      describe('text format', () => {
        beforeEach(async () => {
          initialConfig.globalTags = logTags
          logger = createLogger()
          await logLine({ level: 'warn' })
        })
        it('line should contain log tags', async () => {
          expect(line).toContain('number=1')
          expect(line).toContain('string="1"')
          expect(line).toContain('bool=true')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('warn')
          expect(line).toContain('hello { world: true }')
        })
      })
      describe('json format', () => {
        beforeEach(async () => {
          initialConfig.format = 'json'
          initialConfig.globalTags = logTags
          logger = createLogger()
          await logLine({ level: 'warn' })
        })
        it('line should contain log tags', async () => {
          expect(line).toContain('"number":1')
          expect(line).toContain('"string":"1"')
          expect(line).toContain('"bool":true')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('warn')
          expect(line).toContain('hello { world: true }')
        })
      })
      describe('assignGlobalTags', () => {
        describe('add more tags', () => {
          beforeEach(async () => {
            initialConfig.globalTags = logTags
            logger = createLogger()
            logger.assignGlobalTags({ newTag: 'data', superNewTag: 'tag', functionTag: () => 5 })
            await logLine({ level: 'warn' })
          })
          it('should contain old tags', () => {
            expect(line).toContain('number=1')
            expect(line).toContain('string="1"')
            expect(line).toContain('bool=true')
          })
          it('line should contain basic log data', () => {
            expect(line).toMatch(TIMESTAMP_REGEX)
            expect(line).toContain(NAMESPACE)
            expect(line).toContain('warn')
            expect(line).toContain('hello { world: true }')
          })
          it('should contain new logTags also', async () => {
            expect(line).toContain('newTag="data"')
            expect(line).toContain('functionTag=5')
            expect(line).toContain('superNewTag="tag"')
          })
        })
        describe('clear all tags', () => {
          beforeEach(async () => {
            initialConfig.globalTags = logTags
            logger = createLogger()
            logger.assignGlobalTags(undefined)
            await logLine({ level: 'warn' })
          })
          it('should not contain old tags', () => {
            expect(line).not.toContain('number=1')
            expect(line).not.toContain('string="1"')
            expect(line).not.toContain('bool=true')
          })
          it('line should contain basic log data', () => {
            expect(line).toMatch(TIMESTAMP_REGEX)
            expect(line).toContain(NAMESPACE)
            expect(line).toContain('warn')
            expect(line).toContain('hello { world: true }')
          })
        })
        describe('globalTags transfer between 2 repos', () => {
          let logger2: Logger
          let logger3: Logger
          let line1: string
          let line2: string

          beforeEach(async () => {
            logger = createLogger()
            logger.assignGlobalTags({ someTags: 'tag here' })
            logger2 = createLogger()
            logger2.error('something happened')
            logger2.assignGlobalTags({ someTags: undefined })
            logger3 = createLogger()
            logger3.error('something happened');
            [line1, line2] = consoleStream.contents().split(EOL)
          })

          it('line1 should contain global logTags assigned from other repo', () => {
            expect(line1).toMatch(/someTags="tag here"/)
          })

          it('line2 should not contain global logTags assigned from other repo', () => {
            expect(line2).not.toMatch(/someTags="tag here"/)
          })
        })
      })
    })

    describe('maxJsonMessageSize', () => {
      it('line should contain empty message', async () => {
        initialConfig.maxJsonMessageSize = 0
        initialConfig.format = 'json'
        logger = createLogger()
        await logLine({ level: 'warn' })
        const [lineData] = consoleStream.contents().split('\n')
        const jsonLine = JSON.parse(lineData)
        expect(jsonLine.message).toEqual('')
      })
    })

    it('line should contain partial message', async () => {
      initialConfig.maxJsonMessageSize = 4
      initialConfig.format = 'json'
      logger = createLogger()
      await logLine({ level: 'warn' })
      const [lineData] = consoleStream.contents().split('\n')
      const jsonLine = JSON.parse(lineData)
      expect(jsonLine.message).toEqual('hell')
    })
  })
  describe('log level methods', () => {
    beforeEach(() => {
      [initialConfig.minLevel] = LOG_LEVELS
      initialConfig.colorize = false
      logger = createLogger()
    })

    LOG_LEVELS.forEach(level => {
      describe(`when calling method ${level}`, () => {
        beforeEach(async () => {
          await logLine({ level })
        })

        it('should log the message correctly', () => {
          expect(line).toContain(`${level} ${NAMESPACE} hello { world: true }`)
        })
      })
    })
  })

  describe('time', () => {
    beforeEach(() => {
      initialConfig.minLevel = 'debug'
      initialConfig.colorize = false
      logger = createLogger()
    })

    describe('when a sync method is given', () => {
      const expectedResult = { hello: 'world' }
      let result: unknown
      let startLine: string

      beforeEach(async () => {
        result = logger.time(() => expectedResult, 'hello func %o', 12)
        await repo.end();
        [startLine, line] = consoleStream.contents().split(EOL)
      })

      it('should return the original value', () => {
        expect(result).toBe(expectedResult)
      })

      it('should log the time correctly', () => {
        expect(startLine).toContain(`debug ${NAMESPACE} hello func 12 starting`)
        expect(line).toContain(`debug ${NAMESPACE} hello func 12 took`)
      })
    })

    describe('when an async method is given', () => {
      const expectedResult = { hello: 'world' }
      let result: unknown
      let startLine: string

      beforeEach(async () => {
        result = await logger.time(async () => expectedResult, 'hello func %o', 12)
        await repo.end();
        [startLine, line] = consoleStream.contents().split('\n')
      })

      it('should return the original value', () => {
        expect(result).toBe(expectedResult)
      })

      it('should log the time correctly', () => {
        expect(startLine).toContain(`debug ${NAMESPACE} hello func 12 starting`)
        expect(line).toContain(`debug ${NAMESPACE} hello func 12 took`)
      })
    })
  })
  describe('logger creation', () => {
    beforeEach(() => {
      logger = createLogger()
    })

    describe('when created with a string namespace', () => {
      beforeEach(async () => {
        logger = repo(NAMESPACE)
        await logLine()
      })

      it('should write the message with the namespace', () => {
        expect(line).toContain(`${NAMESPACE}`)
      })

      describe('when getting the same logger again', () => {
        let logger2: Logger

        beforeEach(() => {
          logger2 = repo(NAMESPACE)
        })

        it('should return the same instance', () => {
          expect(logger).toBe(logger2)
        })
      })
    })

    describe('when created with a module namespace arg', () => {
      beforeEach(async () => {
        logger = repo(module)
        await logLine()
      })

      it('should write the message with the child namespace as string', () => {
        expect(line).toContain('logging/test/internal/pino_logger.test')
      })

      describe('when getting the same logger again', () => {
        let logger2: Logger

        beforeEach(() => {
          logger2 = repo(module)
        })

        it('should return the same instance', () => {
          expect(logger).toBe(logger2)
        })
      })
    })

    describe('when created with existing logTags in globals', () => {
      beforeEach(async () => {
        global.globalLogTags = { someTags: 'tag here' }
        logger = repo(NAMESPACE)
        await logLine()
        global.globalLogTags = {}
      })

      it('should include logTag from globals', () => {
        expect(line).toMatch(/someTags="tag here"/)
      })
    })
  })
  describe('setMinLevel', () => {
    describe('when a partial config is specified', () => {
      beforeEach(async () => {
        logger = createLogger()
        repo.setMinLevel('debug')
        await logLine({ level: 'debug' })
      })

      it('should update the existing logger', () => {
        expect(line).not.toHaveLength(0)
      })
    })
  })

  let jsonLine: { [key: string]: unknown }
  describe('logging Error instances', () => {
    let error: Error

    class MyError extends Error {
      readonly customProp1: string
      readonly customProp2: { aNumber: number }
      constructor(message: string, customProp1: string, customProp2: { aNumber: number }) {
        super(message)
        this.customProp1 = customProp1
        this.customProp2 = customProp2
      }
    }

    beforeEach(() => {
      error = new MyError('testing 123', 'customVal1', { aNumber: 42 })
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
        expect(consoleStream.contents())
          // custom props
          .toContain("customProp1: 'customVal1', customProp2: { aNumber: 42 }")
      })
    })

    describe('when format is "json"', () => {
      beforeEach(() => {
        initialConfig.format = 'json'
        logger = createLogger()
        logger.log('warn', error)
        const [line1] = consoleStream.contents().split('\n')
        jsonLine = JSON.parse(line1)
      })

      it('should log the error message and stack as JSON on a single line', () => {
        expect(jsonLine).toMatchObject({
          time: expect.stringMatching(TIMESTAMP_REGEX),
          level: 'warn',
          message: 'testing 123',
          stack: error.stack,
          customProp1: 'customVal1',
          customProp2: { aNumber: 42 },
        })
      })
    })
  })
  describe('JSON format', () => {
    beforeEach(async () => {
      initialConfig.format = 'json'
      logger = createLogger()
    })
    describe('without excess args', () => {
      beforeEach(async () => {
        await logLine({ level: 'warn' })
        jsonLine = JSON.parse(line)
      })
      it('should log the props as JSON', async () => {
        expect(jsonLine).toMatchObject({
          time: expect.stringMatching(TIMESTAMP_REGEX),
          level: 'warn',
          message: 'hello { world: true }',
        })
      })
      it('should log only the expected properties', async () => {
        expect(Object.keys(jsonLine).sort()).toEqual([
          'level', 'message', 'name', 'time',
        ])
      })

      it('should not colorize the line', () => {
        expect(line).not.toContainColors()
      })
    })
    describe('with excess args', () => {
      afterEach(async () => {
        await repo.end()
      })

      it('verify object was extended with excess args formatted object - simple', async () => {
        logger.warn(
          'where is extra args object %s',
          'foo',
          'moo',
          { extra: 'should be in log' },
          true,
          'string with "bad chars"\t\n'
        );
        [line] = consoleStream.contents().split(EOL)
        jsonLine = JSON.parse(line)
        expect(jsonLine).toMatchObject({
          time: expect.stringMatching(TIMESTAMP_REGEX),
          level: 'warn',
          message: 'where is extra args object foo',
          arg0: 'moo',
          extra: 'should be in log',
          arg2: true,
          arg3: '"string with \\"bad chars\\"\\t\\n"',
        })
      })

      it('verify object was extended with excess args formatted object - complex', async () => {
        logger.warn(
          'where is extra args object %s',
          'foo',
          { inlineTag1: 'inlineTag1', inlineTag2: 'inlineTag2', inlineTag3: 'so many tags' },
          { extra: 'should be in log' },
          () => 'shouldn\'t be in log '
        );
        [line] = consoleStream.contents().split(EOL)
        jsonLine = JSON.parse(line)
        expect(jsonLine).toMatchObject({
          time: expect.stringMatching(TIMESTAMP_REGEX),
          level: 'warn',
          message: 'where is extra args object foo',
          inlineTag1: 'inlineTag1',
          inlineTag2: 'inlineTag2',
          inlineTag3: 'so many tags',
          extra: 'should be in log',
          arg2: '[Function]',
        })
      })

      it('verify object was extended with excess args another', async () => {
        logger.warn('where is mix object %s', 'foo', { moo: 'moo', foo: 'foo', boo: { loo: 'loo' } }, { extra: 'should be in log' });
        [line] = consoleStream.contents().split(EOL)
        jsonLine = JSON.parse(line)
        expect(jsonLine).toMatchObject({
          time: expect.stringMatching(TIMESTAMP_REGEX),
          level: 'warn',
          message: 'where is mix object foo',
          moo: 'moo',
          foo: 'foo',
          boo: { loo: 'loo' },
          extra: 'should be in log',
        })
      })
    })
  })

  describe('retrieving the logger config', () => {
    beforeEach(() => {
      initialConfig.format = 'json'
      logger = createLogger()
    })

    it('should return a Config instance', () => {
      const expectedProperties = 'minLevel filename format namespaceFilter colorize globalTags maxJsonMessageSize'
        .split(' ')
        .sort()

      expect(Object.keys(repo.config).sort()).toEqual(expectedProperties)
    })

    it('should return the configured values', () => {
      expect(repo.config.format).toEqual('json')
    })

    it('should return a frozen object', () => {
      expect(() => { (repo.config as Config).minLevel = 'info' }).toThrow()
    })
  })
  describe('local logging tags', () => {
    const logTags = { number: 1, string: '1', bool: true, functionTag: () => 5 }

    describe('text format', () => {
      describe('without global loggers', () => {
        beforeEach(async () => {
          logger = createLogger()
          logger.assignTags(logTags)
          await logLine({ level: 'warn' })
        })
        it('line should contain log tags', async () => {
          expect(line).toContain('number=1')
          expect(line).toContain('string="1"')
          expect(line).toContain('bool=true')
          expect(line).toContain('functionTag=5')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('warn')
          expect(line).toContain('hello { world: true }')
        })
      })
      describe('complex function tags', () => {
        const complexTags = {
          normalTags: 1,
          functionStringTags: () => '5',
          functionObjTag: () => ({ something: 'bad', happened: 'here' }),
        }
        beforeEach(async () => {
          logger = createLogger()
          logger.assignTags(complexTags)
          await logLine({ level: 'warn' })
        })
        it('line should contain log tags', async () => {
          expect(line).toContain('normalTags=1')
          expect(line).toContain('functionStringTags="5"')
          expect(line).toContain('functionObjTag={"something":"bad","happened":"here"}')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('warn')
          expect(line).toContain('hello { world: true }')
        })
      })
      describe('with global tags', () => {
        const moreTags = { anotherTag: 'foo', anotherNumber: 4 }
        beforeEach(async () => {
          initialConfig.minLevel = 'info'
          initialConfig.globalTags = moreTags
          logger = createLogger()
          logger.assignTags(logTags)
          logger.log(
            'error', 'lots of data %s', 'datadata', 'excessArgs',
            true, { someArg: { with: 'data' }, anotherArg: 'much simpler' }, 'bad\n\t"string', undefined
          );
          [line] = consoleStream.contents().split(EOL)
        })

        it('should contain parent log tags', () => {
          expect(line).toContain('number=1')
          expect(line).toContain('string="1"')
          expect(line).toContain('bool=true')
        })
        it('should new log tags', () => {
          expect(line).toContain('anotherTag="foo"')
          expect(line).toContain('anotherNumber=4')
        })
        it('should contain excess arg', () => {
          expect(line).toContain('arg0="excessArgs"')
          expect(line).toContain('arg1=true')
          expect(line).toContain('someArg={"with":"data"}')
          expect(line).toContain('anotherArg="much simpler"')
          expect(line).toContain('arg3="bad\\n\\t\\"string"')
          expect(line).toContain('arg4="undefined"')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('error')
          expect(line).toContain('lots of data datadata')
        })
      })
    })

    describe('json format', () => {
      beforeEach(() => {
        initialConfig.format = 'json'
      })
      describe('without global tags', () => {
        beforeEach(async () => {
          logger = createLogger()
          logger.assignTags(logTags)
          await logLine({ level: 'warn' })
        })
        it('line should contain log tags', async () => {
          expect(line).toContain('"number":1')
          expect(line).toContain('"functionTag":5')
          expect(line).toContain('"string":"1"')
          expect(line).toContain('"bool":true')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('warn')
          expect(line).toContain('hello { world: true }')
        })
      })
      describe('with global tags', () => {
        const moreTags = { anotherTag: 'foo', anotherNumber: 4 }
        beforeEach(async () => {
          initialConfig.minLevel = 'info'
          initialConfig.globalTags = moreTags
          logger = createLogger()
          logger.assignTags(logTags)
          logger.log('error', 'lots of data %s', 'datadata',
            { firstExcess: 'simple', secondExcess: { complex: 'data' } },
            'mixExcessArgs', 'moreExcess');
          [line] = consoleStream.contents().split(EOL)
        })
        it('should contain parent log tags', () => {
          expect(line).toContain('"number":1')
          expect(line).toContain('"string":"1"')
          expect(line).toContain('"bool":true')
        })
        it('should new log tags', () => {
          expect(line).toContain('"anotherTag":"foo"')
          expect(line).toContain('"anotherNumber":4')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('error')
          expect(line).toContain('lots of data datadata')
        })
        it('should contain excess data', () => {
          expect(line).toContain('"firstExcess":"simple"')
          expect(line).toContain('"secondExcess":{"complex":"data"}')
          expect(line).toContain('"arg1":"mixExcessArgs"')
          expect(line).toContain('"arg2":"moreExcess"')
        })
      })
    })

    describe('remove assigned tags', () => {
      describe('remove all tags', () => {
        beforeEach(async () => {
          logger = createLogger()
          logger.assignTags(logTags)
          logger.assignTags(undefined)
          await logLine({ level: 'warn' })
        })
        it('line should not contain log tags', async () => {
          expect(line).not.toContain('number=1')
          expect(line).not.toContain('string=1')
          expect(line).not.toContain('bool=true')
          expect(line).not.toContain('functionTag=5')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('warn')
          expect(line).toContain('hello { world: true }')
        })
      })
      describe('remove some tags', () => {
        beforeEach(async () => {
          logger = createLogger()
          logger.assignTags(logTags)
          logger.assignTags({ number: undefined, string: undefined, anotherTag: 'foo' })
          await logLine({ level: 'warn' })
        })
        it('line should contain current log tags', async () => {
          expect(line).not.toContain('number=1')
          expect(line).not.toContain('string=1')
          expect(line).toContain('bool=true')
          expect(line).toContain('anotherTag="foo"')
          expect(line).toContain('functionTag=5')
        })
        it('line should contain basic log data', () => {
          expect(line).toMatch(TIMESTAMP_REGEX)
          expect(line).toContain(NAMESPACE)
          expect(line).toContain('warn')
          expect(line).toContain('hello { world: true }')
        })
      })
    })
  })
})
