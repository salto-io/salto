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
import { logger, LogLevel } from '@salto-io/logging'
import { loadLocalWorkspace } from '@salto-io/core'
import { mockFunction } from '@salto-io/test-utils'
import * as mocks from './mocks'
import {
  createPublicCommandDef,
  CommandDefAction,
  WorkspaceCommandAction,
  createWorkspaceCommand,
  CommandDef,
} from '../src/command_builder'
import { SpinnerCreator, CliExitCode, CliError } from '../src/types'
import {
  CONFIG_OVERRIDE_OPTION,
  ConfigOverrideArg,
  getConfigOverrideChanges,
} from '../src/commands/common/config_override'
import { buildEventName } from '../src/telemetry'

jest.mock('@salto-io/core', () => {
  const actual = jest.requireActual('@salto-io/core')
  return {
    ...actual,
    loadLocalWorkspace: jest.fn().mockImplementation(actual.loadLocalWorkspace),
  }
})

describe('Command builder', () => {
  describe('createPublicCommandDef', () => {
    describe('with valid command', () => {
      type DummyCommandArgs = {
        bool: boolean
        string: string
        choices: 'a' | 'b' | 'c'
        stringsList: string[]
      }

      const action = mockFunction<CommandDefAction<DummyCommandArgs>>().mockImplementation(
        async ({ input: { bool, string, choices, stringsList } }): Promise<CliExitCode> => {
          if (bool && string && choices && stringsList) {
            if (string === 'error') {
              throw new Error('error')
            }
            return CliExitCode.Success
          }
          return CliExitCode.UserInputError
        },
      )

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
          workspacePath: '.',
          telemetry,
          spinnerCreator,
          commanderInput: ['str', ['str2', 'str3'], { bool: true, choices: 'a' }],
        })
        expect(action.mock.calls[0][0].input).toEqual({
          bool: true,
          choices: 'a',
          string: 'str',
          stringsList: ['str2', 'str3'],
        })
      })

      describe('when log level is above debug', () => {
        let savedLogLevel: LogLevel
        beforeEach(() => {
          const configLevel = logger.config.minLevel
          if (configLevel !== 'none') {
            savedLogLevel = configLevel
            logger.setMinLevel('info')
          }
        })
        afterEach(() => {
          if (savedLogLevel !== undefined) {
            logger.setMinLevel(savedLogLevel)
          }
        })
        it('Should add verbose option and up the log level if called with verbose', async () => {
          expect(createdCommandDef.properties.keyedOptions?.find(op => String(op.name) === 'verbose')).toBeTruthy()
          const setMinLevel = jest.spyOn(logger, 'setMinLevel')
          await createdCommandDef.action({
            output,
            config,
            workspacePath: '.',
            telemetry,
            spinnerCreator,
            commanderInput: ['str', ['str2', 'str3'], { bool: true, choices: 'a', verbose: true }],
          })
          expect(setMinLevel).toHaveBeenCalledWith('debug')
        })
      })

      it('Should throw an error when called with wrong choice', async () => {
        await expect(
          createdCommandDef.action({
            output,
            config,
            workspacePath: '.',
            telemetry,
            spinnerCreator,
            commanderInput: ['str', { bool: true, choices: 'wrongChoice' }],
          }),
        ).rejects.toThrow(CliError)
      })

      it('Should throw CliError when action is returned with non-success code', async () => {
        await expect(
          createdCommandDef.action({
            output,
            config,
            workspacePath: '.',
            telemetry,
            spinnerCreator,
            commanderInput: ['error', { bool: true, choices: 'a' }],
          }),
        ).rejects.toThrow(CliError)
      })
    })
    describe('with conflicting flag definitions', () => {
      describe('with conflicting flag name', () => {
        it('should throw error', () => {
          expect(() =>
            createPublicCommandDef({
              properties: {
                name: 'dummy',
                description: 'test',
                keyedOptions: [{ name: 'test', type: 'string' }],
                positionalOptions: [{ name: 'test', type: 'string', required: false }],
              },
              action: async (_: { input: { test: string } }) => CliExitCode.Success,
            }),
          ).toThrow()
        })
      })
      describe('with conflicting flag alias', () => {
        it('should throw error', () => {
          expect(() =>
            createPublicCommandDef({
              properties: {
                name: 'dummy',
                description: 'test',
                keyedOptions: [
                  { name: 'test1', type: 'string', alias: 't' },
                  { name: 'test2', type: 'string', alias: 't' },
                ],
              },
              action: async (_: { input: { test1: string; test2: string } }) => CliExitCode.Success,
            }),
          ).toThrow()
        })
      })
    })
  })
  describe('createWorkspaceCommand', () => {
    let dummyAction: jest.MockedFunction<WorkspaceCommandAction<{}>>
    let command: CommandDef<unknown>
    beforeEach(() => {
      dummyAction = mockFunction<typeof dummyAction>().mockResolvedValue(CliExitCode.Success)
      command = createWorkspaceCommand({
        properties: {
          name: 'dummy',
          description: 'test',
        },
        action: dummyAction,
      }) as CommandDef<unknown>
    })
    describe('command', () => {
      it('should have config override option', () => {
        expect(command.properties.keyedOptions).toContainEqual(CONFIG_OVERRIDE_OPTION)
      })
    })
    describe('action', () => {
      let cliArgs: mocks.MockCliArgs
      let workspace: mocks.MockWorkspace
      beforeEach(() => {
        cliArgs = mocks.mockCliArgs()
        workspace = mocks.mockWorkspace({ uid: 'test' })

        const loadWorkspace = loadLocalWorkspace as jest.MockedFunction<typeof loadLocalWorkspace>
        loadWorkspace.mockClear()
        loadWorkspace.mockResolvedValue(workspace)
      })
      describe('when called with config overrides', () => {
        let configOverrides: ConfigOverrideArg
        beforeEach(async () => {
          configOverrides = { config: ['salesforce.override=1'] }
          await command.action({
            ...cliArgs,
            workspacePath: 'test_path',
            commanderInput: [configOverrides],
          })
        })
        it('should pass workspace path and config overrides to the workspace', () => {
          const expectedChanges = getConfigOverrideChanges(configOverrides)
          expect(loadLocalWorkspace).toHaveBeenCalledWith({ path: 'test_path', configOverrides: expectedChanges })
        })
      })
      describe('when action is successful', () => {
        beforeEach(async () => {
          await command.action({
            ...cliArgs,
            workspacePath: 'test_path',
            commanderInput: [{}],
          })
        })
        it('should send start and success telemetry', () => {
          const events = cliArgs.telemetry.getEvents()
          expect(events).toContainEqual(
            expect.objectContaining({
              name: buildEventName('dummy', 'start'),
              tags: { workspaceID: 'test', installationID: '1234', app: 'test' },
            }),
          )
          expect(events).toContainEqual(
            expect.objectContaining({
              name: buildEventName('dummy', 'success'),
              tags: { workspaceID: 'test', installationID: '1234', app: 'test' },
            }),
          )
        })
      })
      describe('when action fails', () => {
        let result: Promise<void>
        beforeEach(async () => {
          dummyAction.mockResolvedValue(CliExitCode.UserInputError)
          result = command.action({
            ...cliArgs,
            workspacePath: 'test_path',
            commanderInput: [{}],
          })
          await result.catch(() => undefined)
        })
        it('should fail with a cli error', async () => {
          await expect(result).rejects.toThrow(new CliError(CliExitCode.UserInputError))
        })
        it('should send start and failure telemetry', () => {
          const events = cliArgs.telemetry.getEvents()
          expect(events).toContainEqual(
            expect.objectContaining({
              name: buildEventName('dummy', 'start'),
              tags: { workspaceID: 'test', installationID: '1234', app: 'test' },
            }),
          )
          expect(events).toContainEqual(
            expect.objectContaining({
              name: buildEventName('dummy', 'failure'),
              tags: { workspaceID: 'test', installationID: '1234', app: 'test' },
            }),
          )
        })
      })
    })
  })

  describe('when createWorkspaceCommand with extraTelemetryTags', () => {
    it('should send the extra tags', async () => {
      const dummyAction = mockFunction<WorkspaceCommandAction<{}>>().mockResolvedValue(CliExitCode.Success)
      const command = createWorkspaceCommand({
        properties: {
          name: 'dummy',
          description: 'test',
        },
        action: dummyAction,
        extraTelemetryTags: _ => ({ extraTag1: 'tag1', extraTag2: 'tag2' }),
      }) as CommandDef<unknown>

      const cliArgs = mocks.mockCliArgs()
      const workspace = mocks.mockWorkspace({ uid: 'test' })
      const loadWorkspace = loadLocalWorkspace as jest.MockedFunction<typeof loadLocalWorkspace>
      loadWorkspace.mockResolvedValue(workspace)

      await command.action({
        ...cliArgs,
        workspacePath: 'test_path',
        commanderInput: [{}],
      })

      const events = cliArgs.telemetry.getEvents()
      expect(events).toContainEqual(
        expect.objectContaining({
          name: buildEventName('dummy', 'start'),
          tags: { workspaceID: 'test', installationID: '1234', app: 'test', extraTag1: 'tag1', extraTag2: 'tag2' },
        }),
      )
      expect(events).toContainEqual(
        expect.objectContaining({
          name: buildEventName('dummy', 'success'),
          tags: { workspaceID: 'test', installationID: '1234', app: 'test', extraTag1: 'tag1', extraTag2: 'tag2' },
        }),
      )
    })
  })
})
