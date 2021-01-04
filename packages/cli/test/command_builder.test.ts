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
import { logger } from '@salto-io/logging'
import * as mocks from './mocks'
import { createPublicCommandDef, CommandDefAction } from '../src/command_builder'
import { SpinnerCreator, CliExitCode, CliError } from '../src/types'

describe('Command builder', () => {
  describe('createPublicCommandDef', () => {
    type DummyCommandArgs = {
      bool: boolean
      string: string
      choices: 'a' | 'b' | 'c'
      stringsList: string[]
    }

    const action = mocks.mockFunction<CommandDefAction<DummyCommandArgs>>()
      .mockImplementation(async ({
        input: { bool, string, choices, stringsList },
      }): Promise<CliExitCode> => {
        if (bool && string && choices && stringsList) {
          if (string === 'error') {
            throw new Error('error')
          }
          return CliExitCode.Success
        }
        return CliExitCode.UserInputError
      })

    const createdCommandDef = createPublicCommandDef({
      properties: {
        name: 'dummyCommand',
        description: 'dummy',
        keyedOptions: [
          {
            name: 'bool',
            alias: 'b',
            description: 'bool',
            type: 'boolean',
          },
          {
            name: 'choices',
            alias: 'c',
            description: 'ch',
            choices: ['a', 'b', 'c'],
            type: 'string',
          },
        ],
        positionalOptions: [
          {
            name: 'string',
            required: true,
            description: 'string',
            type: 'string',
          },
          {
            name: 'stringsList',
            required: false,
            description: 'string',
            type: 'stringsList',
          },
        ],
      },
      action,
    })

    let spinnerCreator: SpinnerCreator
    const config = { shouldCalcTotalSize: true }
    let output: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
    let telemetry: mocks.MockTelemetry

    beforeEach(() => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      spinnerCreator = mocks.mockSpinnerCreator([])
      telemetry = mocks.getMockTelemetry()
      action.mockClear()
    })
    it('Should call the action with positional args mapped rightly and cliTelemetry', async () => {
      await createdCommandDef.action({
        output,
        config,
        telemetry,
        spinnerCreator,
        commanderInput: [
          'str',
          ['str2', 'str3'],
          { bool: true, choices: 'a' },
        ],
      })
      expect(action.mock.calls[0][0].input).toEqual({ bool: true, choices: 'a', string: 'str', stringsList: ['str2', 'str3'] })
    })

    it('Should add verbose option and up the log level if called with verbose', async () => {
      expect(createdCommandDef.properties.keyedOptions?.find(op =>
        String(op.name) === 'verbose')).toBeTruthy()
      const setMinLevel = jest.spyOn(logger, 'setMinLevel')
      await createdCommandDef.action({
        output,
        config,
        telemetry,
        spinnerCreator,
        commanderInput: [
          'str',
          ['str2', 'str3'],
          { bool: true, choices: 'a', verbose: true },
        ],
      })
      expect(setMinLevel).toHaveBeenCalledWith('debug')
    })

    it('Should throw an error when called with wrong choice', async () => {
      await expect(createdCommandDef.action({
        output,
        config,
        telemetry,
        spinnerCreator,
        commanderInput: ['str', { bool: true, choices: 'wrongChoice' }],
      })).rejects.toThrow(CliError)
    })

    it('Should throw CliError when action is returned with non-sucess code', async () => {
      await expect(createdCommandDef.action({
        output,
        config,
        telemetry,
        spinnerCreator,
        commanderInput: ['error', { bool: true, choices: 'a' }],
      })).rejects.toThrow(CliError)
    })
  })
})
