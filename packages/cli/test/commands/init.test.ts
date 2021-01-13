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
import { Workspace } from '@salto-io/workspace'
import { locateWorkspaceRoot } from '@salto-io/core'
import * as mocks from '../mocks'
import { action } from '../../src/commands/init'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'
import { CliTelemetry } from '../../src/types'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  initLocalWorkspace: jest.fn().mockImplementation(
    (_baseDir: string, workspaceName: string): Workspace => {
      if (workspaceName === 'error') throw new Error('failed')
      return {
        name: workspaceName,
        uid: '',
        currentEnv: () => 'default',
        envs: () => ['default'],
      } as unknown as Workspace
    }
  ),
  locateWorkspaceRoot: jest.fn(),
}))

const mockGetEnv = mocks.createMockEnvNameGetter()
const mockLocateWorkspaceRoot = locateWorkspaceRoot as
  jest.MockedFunction<typeof locateWorkspaceRoot>
jest.mock('../../src/callbacks', () => ({
  ...jest.requireActual('../../src/callbacks'),
  getEnvName: () => mockGetEnv(),
}))

const commandName = 'init'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
}

describe('init command', () => {
  let output: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  let telemetry: mocks.MockTelemetry
  let cliTelemetry: CliTelemetry
  const config = { shouldCalcTotalSize: false }

  beforeEach(async () => {
    mockLocateWorkspaceRoot.mockResolvedValue(undefined)
    output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    telemetry = mocks.getMockTelemetry()
    cliTelemetry = getCliTelemetry(telemetry, 'init')
  })

  it('should invoke api\'s init', async () => {
    await action({
      input: {
        workspaceName: 'test',
      },
      config,
      cliTelemetry,
      output,
    })
    expect(output.stdout.content.search('test')).toBeGreaterThan(0)
    expect(telemetry.getEvents()).toHaveLength(2)
    expect(telemetry.getEventsMap()[eventsNames.failure]).toBeUndefined()
    expect(telemetry.getEventsMap()[eventsNames.success]).not.toBeUndefined()
    expect(telemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
  })

  it('should print errors', async () => {
    await action({
      input: {
        workspaceName: 'error',
      },
      config,
      cliTelemetry,
      output,
    })
    expect(output.stderr.content.search('failed')).toBeGreaterThan(0)
    expect(telemetry.getEvents()).toHaveLength(2)
    expect(telemetry.getEventsMap()[eventsNames.success]).toBeUndefined()
    expect(telemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
    expect(telemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
  })

  it('should avoid initiating a workspace which already exists', async () => {
    const path = '/some/path/to/workspace'
    mockLocateWorkspaceRoot.mockResolvedValue(path)
    await action({
      input: {
        workspaceName: 'test',
      },
      config,
      cliTelemetry,
      output,
    })
    expect(output.stderr.content).toEqual(`Could not initiate workspace: existing salto workspace in ${path}\n\n`)
    expect(output.stdout.content).toEqual('')
  })
})
