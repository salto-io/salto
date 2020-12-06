/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import * as mocks from './mocks'
import deployDef from '../src/commands/deploy'
import fetchDef from '../src/commands/fetch'
import { CliExitCode } from '../src/types'

describe('cli as a whole', () => {
  let o: mocks.MockCliOutput
  const cliLogger = logger('cli/cli')

  jest.setTimeout(200)
  jest.spyOn(logger, 'end').mockResolvedValue(undefined)
  const consoleErrorSpy = jest.spyOn(console, 'error')
  const stdout = jest.spyOn(process.stdout, 'write')

  describe('when called with --help', () => {
    beforeEach(async () => {
      stdout.mockClear()
      o = await mocks.cli({ args: ['--help'] })
    })

    it('outputs help to stdout', () => {
      expect(stdout).toHaveBeenCalledWith(expect.stringMatching(/deploy/))
      expect(stdout).toHaveBeenCalledWith(expect.stringMatching('help'))
    })

    it('exits with code 0', () => {
      expect(o.exitCode).toEqual(0)
    })
  })

  describe('when called with --version', () => {
    beforeEach(async () => {
      stdout.mockClear()
      o = await mocks.cli({ args: ['--version'] })
    })

    it('outputs the version to stdout', () => {
      expect(stdout).toHaveBeenCalledWith(expect.stringMatching(/version \d+\.\d+\.\d+/))
    })

    it('exits with code 0', () => {
      expect(o.exitCode).toEqual(0)
    })
  })

  describe('when called with an invalid command', () => {
    beforeEach(async () => {
      consoleErrorSpy.mockClear()
      o = await mocks.cli({ args: ['nosuchcommand'] })
    })

    it('outputs an error message to stderr', () => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/unknown command 'nosuchcommand'/))
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/--help/))
    })

    it('exits with code 1', () => {
      expect(o.exitCode).toEqual(1)
    })
  })

  describe('when called with a valid command argument', () => {
    let deployAction: jest.Mock<Promise<CliExitCode>>

    beforeEach(async () => {
      deployAction = jest.fn().mockImplementation(() => CliExitCode.Success)
      jest.spyOn(deployDef, 'action').mockImplementation(deployAction)
      o = await mocks.cli({ args: ['deploy', '--force'] })
    })

    it('calls the command handler', () => {
      expect(deployAction).toHaveBeenCalled()
    })

    it('exits with code 0 (success)', () => {
      expect(o.exitCode).toEqual(CliExitCode.Success)
    })
  })

  describe('When called with an invalid choice', () => {
    let fetchAction: jest.Mock<Promise<CliExitCode>>
    beforeEach(async () => {
      fetchAction = jest.fn()
      jest.spyOn(fetchDef, 'action').mockImplementation(fetchAction)
      o = await mocks.cli({ args: ['fetch', '--mode', 'unknown'] })
    })

    it('Should print error to stderr', () => {
      expect(o.err).toMatch(/must be one of/)
    })

    it('Should not call fetch action', () => {
      expect(fetchAction).not.toHaveBeenCalled()
    })

    it('exits with code 1', () => {
      expect(o.exitCode).toEqual(1)
    })
  })

  describe('when command execution fails ', () => {
    let deployAction: jest.Mock<Promise<CliExitCode>>

    beforeEach(async () => {
      deployAction = jest.fn().mockImplementation(() => CliExitCode.AppError)
      jest.spyOn(deployDef, 'action').mockImplementation(deployAction)
      o = await mocks.cli({ args: ['deploy', '--force'] })
    })

    it('calls the command handler', () => {
      expect(deployAction).toHaveBeenCalled()
    })

    it('exits with code 2 (app error)', () => {
      expect(o.exitCode).toEqual(CliExitCode.AppError)
    })

    it('calls logger.end', () => {
      expect(logger.end).toHaveBeenCalled()
    })
  })

  describe('when command execution throws error ', () => {
    let deployAction: jest.Mock<Promise<CliExitCode>>

    beforeEach(async () => {
      deployAction = jest.fn().mockImplementation(() => { throw new Error('blabla') })
      jest.spyOn(cliLogger, 'error').mockReturnValue(undefined)
      jest.spyOn(deployDef, 'action').mockImplementation(deployAction)
      o = await mocks.cli({ args: ['deploy', '--force'] })
    })

    it('calls the command handler', () => {
      expect(deployAction).toHaveBeenCalled()
    })

    it('exits with code 2 (app error)', () => {
      expect(o.exitCode).toEqual(CliExitCode.AppError)
    })

    it('logs the error', () => {
      expect(cliLogger.error).toHaveBeenCalled()
    })

    it('calls logger.end', () => {
      expect(logger.end).toHaveBeenCalled()
    })
  })

  describe('when called with --verbose', () => {
    let setMinLevel: jest.SpyInstance

    beforeEach(async () => {
      setMinLevel = jest.spyOn(logger, 'setMinLevel')
      await mocks.cli({ args: ['deploy', '--force', '--verbose'] })
    })

    it('configures the logging to level debug', () => {
      expect(setMinLevel).toHaveBeenCalledWith('debug')
    })
  })
})
