/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import * as env from '../src/commands/env'
import { CliExitCode, CliError } from '../src/types'

describe('cli as a whole', () => {
  let o: mocks.MockCliReturn

  jest.setTimeout(200)
  jest.spyOn(logger, 'end').mockResolvedValue(undefined)
  const consoleErrorSpy = jest.spyOn(console, 'error')
  const stdout = jest.spyOn(process.stdout, 'write')
  const stderr = jest.spyOn(process.stderr, 'write')

  describe('when called with --help', () => {
    beforeEach(async () => {
      stdout.mockClear()
      o = await mocks.cli({ args: ['--help'] })
    })

    it('outputs help to stdout', () => {
      expect(stdout).toHaveBeenCalledWith(expect.stringMatching(/Usage: salto \[options\] \[command\]/))
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
      stderr.mockClear()
      o = await mocks.cli({ args: ['nosuchcommand'] })
    })

    it('outputs an error message to stderr', () => {
      expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/unknown command 'nosuchcommand'/))
      expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/--help/))
    })

    it('exits with code 1', () => {
      expect(o.exitCode).toEqual(1)
    })
  })

  describe('When called with an existing command', () => {
    let deployAction: jest.Mock<Promise<void>>
    beforeEach(() => {
      stdout.mockClear()
      deployAction = jest.fn()
      jest.spyOn(deployDef, 'action').mockImplementation(deployAction)
    })

    it('Should call deploy action when deploy is called', async () => {
      o = await mocks.cli({ args: ['deploy'] })
      expect(deployAction).toHaveBeenCalled()
    })

    it('Should print help and not call action if called with help', async () => {
      o = await mocks.cli({ args: ['deploy', '--help'] })
      expect(stdout).toHaveBeenCalledWith(expect.stringMatching(/Usage: salto deploy \[options\]/))
    })
  })

  describe('When called with an existing command group', () => {
    beforeEach(() => {
      stdout.mockClear()
    })

    it('Should print specific help if called with help', async () => {
      o = await mocks.cli({ args: ['env', '--help'] })
      expect(stdout).toHaveBeenCalledWith(expect.stringMatching(/Usage: salto env \[options\] \[command\]/))
    })
  })

  describe('When action throws a UserInputError CliError', () => {
    let deployAction: jest.Mock<Promise<void>>
    beforeEach(() => {
      consoleErrorSpy.mockClear()
      deployAction = jest.fn().mockImplementation(() => {
        throw new CliError(CliExitCode.UserInputError)
      })
      jest.spyOn(deployDef, 'action').mockImplementation(deployAction)
    })

    it('Should not print anything to stderr and exit with code 1', async () => {
      o = await mocks.cli({ args: ['deploy'] })
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(o.exitCode).toEqual(1)
    })
  })

  describe('When action throws a AppError CliError', () => {
    let deployAction: jest.Mock<Promise<void>>
    beforeEach(() => {
      consoleErrorSpy.mockClear()
      deployAction = jest.fn().mockImplementation(() => {
        throw new CliError(CliExitCode.AppError)
      })
      jest.spyOn(deployDef, 'action').mockImplementation(deployAction)
    })

    it('Should not print anything to stderr and exit with code 2', async () => {
      o = await mocks.cli({ args: ['deploy'] })
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(o.exitCode).toEqual(2)
    })
  })

  describe('When action throws a non-CliError', () => {
    let deployAction: jest.Mock<Promise<void>>
    beforeEach(() => {
      deployAction = jest.fn().mockImplementation(() => {
        throw new Error('Message to print')
      })
      jest.spyOn(deployDef, 'action').mockImplementation(deployAction)
    })

    it('Should print the error msg to output err and exit with code 2', async () => {
      o = await mocks.cli({ args: ['deploy'] })
      expect(o.err).toContain('Message to print')
      expect(o.exitCode).toEqual(2)
    })
  })

  describe('When called with an existing sub-command', () => {
    let listAction: jest.SpyInstance
    beforeAll(() => {
      stdout.mockClear()
      listAction = jest.spyOn(env, 'listAction')
    })

    it('Should print specific help if called with help', async () => {
      o = await mocks.cli({ args: ['env', 'list', '--help'] })
      expect(stdout).toHaveBeenCalledWith(expect.stringMatching(/Usage: salto env list \[options\]/))
      expect(listAction).not.toHaveBeenCalled()
    })

    it('Should call the action the sub-command is called', async () => {
      const subCommandAction: jest.Mock<Promise<void>> = jest.fn()
      const commandGroup = {
        properties: {
          name: 'group',
          description: 'd',
        },
        subCommands: [
          {
            properties: {
              name: 'dummySub',
              description: 'd',
            },
            action: subCommandAction,
          },
        ],
      }
      o = await mocks.cli({ commandDefs: [commandGroup], args: ['group', 'dummySub'] })
      expect(subCommandAction).toHaveBeenCalled()
    })
  })
})
