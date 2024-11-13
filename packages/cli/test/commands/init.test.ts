/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  initLocalWorkspace: jest.fn().mockImplementation((_baseDir: string, envName: string): Workspace => {
    if (envName === 'error') throw new Error('failed')
    return {
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
        input: {},
      })
      expect(output.stdout.content.includes('Initiated')).toBeTruthy()
      expect(telemetry.sendCountEvent).toHaveBeenCalledTimes(2)
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.start, 1, expect.objectContaining({}))
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.success, 1, expect.objectContaining({}))
    })
    it('should print errors', async () => {
      await action({
        ...cliCommandArgs,
        input: {
          envName: 'error',
        },
      })
      expect(output.stderr.content.search('failed')).toBeGreaterThan(0)
      expect(telemetry.sendCountEvent).toHaveBeenCalledTimes(2)
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.start, 1, expect.objectContaining({}))
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.failure, 1, expect.objectContaining({}))
    })
  })
  describe('without interactive env input ', () => {
    it("should invoke api's init", async () => {
      await action({
        ...cliCommandArgs,
        input: {
          envName: 'userEnvInput',
        },
      })
      expect(output.stdout.content.includes('Initiated')).toBeTruthy()
      expect(telemetry.sendCountEvent).toHaveBeenCalledTimes(2)
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.start, 1, expect.objectContaining({}))
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.success, 1, expect.objectContaining({}))
      expect(mockInitLocalWorkspace).toHaveBeenCalledWith(expect.anything(), 'userEnvInput')
    })
    it('should print errors', async () => {
      await action({
        ...cliCommandArgs,
        input: {
          envName: 'error',
        },
      })
      expect(output.stderr.content.search('failed')).toBeGreaterThan(0)
      expect(telemetry.sendCountEvent).toHaveBeenCalledTimes(2)
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.start, 1, expect.objectContaining({}))
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.failure, 1, expect.objectContaining({}))
    })
  })

  it('should avoid initiating a workspace which already exists', async () => {
    const path = '/some/path/to/workspace'
    mockLocateWorkspaceRoot.mockResolvedValue(path)
    await action({
      ...cliCommandArgs,
      input: {},
    })
    expect(output.stderr.content).toEqual(`Could not initiate workspace: existing salto workspace in ${path}\n`)
    expect(output.stdout.content).toEqual('')
  })
})
