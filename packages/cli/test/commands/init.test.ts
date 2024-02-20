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
import { Workspace } from '@salto-io/workspace'
import { initLocalWorkspace, locateWorkspaceRoot } from '@salto-io/core'
import * as mocks from '../mocks'
import { action } from '../../src/commands/init'
import { buildEventName } from '../../src/telemetry'
import { getEnvName } from '../../src/callbacks'
import { CommandArgs } from '../../src/command_builder'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
  initLocalWorkspace: jest.fn().mockImplementation((_baseDir: string, workspaceName: string): Workspace => {
    if (workspaceName === 'error') throw new Error('failed')
    return {
      name: workspaceName,
      uid: '',
      currentEnv: () => 'default',
      envs: () => ['default'],
    } as unknown as Workspace
  }),
  locateWorkspaceRoot: jest.fn(),
}))

const mockLocateWorkspaceRoot = locateWorkspaceRoot as jest.MockedFunction<typeof locateWorkspaceRoot>
const mockInitLocalWorkspace = initLocalWorkspace as jest.MockedFunction<typeof initLocalWorkspace>

jest.mock('../../src/callbacks', () => {
  const actual = jest.requireActual('../../src/callbacks')
  return {
    ...actual,
    getEnvName: jest.fn().mockImplementation(actual.getEnvName),
  }
})
const mockGetEnvName = getEnvName as jest.MockedFunction<typeof getEnvName>

const commandName = 'init'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
}

describe('init command', () => {
  let cliCommandArgs: CommandArgs
  let telemetry: mocks.MockTelemetry
  let output: mocks.MockCliOutput
  beforeEach(async () => {
    jest.clearAllMocks()
    mockGetEnvName.mockResolvedValue('default')
    mockLocateWorkspaceRoot.mockResolvedValue(undefined)
    const cliArgs = mocks.mockCliArgs()
    cliCommandArgs = {
      ...mocks.mockCliCommandArgs(commandName, cliArgs),
      workspacePath: '.',
    }
    telemetry = cliArgs.telemetry
    output = cliArgs.output
  })
  describe('with interactive env input ', () => {
    it("should invoke api's init", async () => {
      await action({
        ...cliCommandArgs,
        input: {
          workspaceName: 'test',
        },
      })
      expect(output.stdout.content.includes('Initiated')).toBeTruthy()
      expect(telemetry.getEvents()).toHaveLength(2)
      expect(telemetry.getEventsMap()[eventsNames.failure]).toBeUndefined()
      expect(telemetry.getEventsMap()[eventsNames.success]).not.toBeUndefined()
      expect(telemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
    })
    it('should print errors', async () => {
      await action({
        ...cliCommandArgs,
        input: {
          workspaceName: 'error',
        },
      })
      expect(output.stderr.content.search('failed')).toBeGreaterThan(0)
      expect(telemetry.getEvents()).toHaveLength(2)
      expect(telemetry.getEventsMap()[eventsNames.success]).toBeUndefined()
      expect(telemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
      expect(telemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
    })
  })
  describe('without interactive env input ', () => {
    it("should invoke api's init", async () => {
      await action({
        ...cliCommandArgs,
        input: {
          workspaceName: 'test',
          envName: 'userEnvInput',
        },
      })
      expect(output.stdout.content.includes('Initiated')).toBeTruthy()
      expect(telemetry.getEvents()).toHaveLength(2)
      expect(telemetry.getEventsMap()[eventsNames.failure]).toBeUndefined()
      expect(telemetry.getEventsMap()[eventsNames.success]).not.toBeUndefined()
      expect(telemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
      expect(mockInitLocalWorkspace).toHaveBeenCalledWith(expect.anything(), 'test', 'userEnvInput')
    })
    it('should print errors', async () => {
      await action({
        ...cliCommandArgs,
        input: {
          workspaceName: 'error',
          envName: 'userEnvInput',
        },
      })
      expect(output.stderr.content.search('failed')).toBeGreaterThan(0)
      expect(telemetry.getEvents()).toHaveLength(2)
      expect(telemetry.getEventsMap()[eventsNames.success]).toBeUndefined()
      expect(telemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
      expect(telemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
    })
  })

  it('should avoid initiating a workspace which already exists', async () => {
    const path = '/some/path/to/workspace'
    mockLocateWorkspaceRoot.mockResolvedValue(path)
    await action({
      ...cliCommandArgs,
      input: {
        workspaceName: 'test',
      },
    })
    expect(output.stderr.content).toEqual(`Could not initiate workspace: existing salto workspace in ${path}\n\n`)
    expect(output.stdout.content).toEqual('')
  })
})
