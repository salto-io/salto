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
import * as core from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { CliExitCode, CliTelemetry } from '../../src/types'
import * as callbacks from '../../src/callbacks'
import { getCliTelemetry, buildEventName } from '../../src/telemetry'
import * as mocks from '../mocks'
import { command } from '../../src/commands/clean'

const commandName = 'clean'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
}

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  getDefaultAdapterConfig: jest.fn().mockImplementation(service => ({ a: 'a', serviceName: service })),
  loadLocalWorkspace: jest.fn(),
  cleanWorkspace: jest.fn(),
}))

describe('clean command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  let mockTelemetry: mocks.MockTelemetry
  let mockCliTelemetry: CliTelemetry

  let lastWorkspace: Workspace

  beforeEach(async () => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockTelemetry = mocks.getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'clean')
    jest.spyOn(core, 'loadLocalWorkspace').mockImplementation(baseDir => {
      lastWorkspace = mocks.mockLoadWorkspace(baseDir)
      return Promise.resolve(lastWorkspace)
    })
    jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementation(() => Promise.resolve(true))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('with no clean args', () => {
    it('should do nothing and return error', async () => {
      expect(await command('.', mockCliTelemetry, cliOutput, false, {
        nacl: false,
        state: false,
        cache: false,
        staticResources: false,
        credentials: false,
        serviceConfig: false,
      }).execute()).toBe(CliExitCode.UserInputError)
      expect(cliOutput.stdout.content.search('Nothing to do.')).toBeGreaterThan(0)
      expect(core.loadLocalWorkspace).not.toHaveBeenCalled()
    })
  })

  describe('with all args and no force flag', () => {
    it('should prompt user and exit if no', async () => {
      jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(() => Promise.resolve(false))

      expect(await command('.', mockCliTelemetry, cliOutput, false, {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
        serviceConfig: true,
      }).execute()).toBe(CliExitCode.Success)
      expect(core.loadLocalWorkspace).toHaveBeenCalled()
      expect(callbacks.getUserBooleanInput).toHaveBeenCalledWith('Do you want to perform these actions?')
      expect(cliOutput.stdout.content.search('Canceling...')).toBeGreaterThan(0)
    })

    it('should fail if trying to clean static resources without all dependent components', async () => {
      expect(await command('.', mockCliTelemetry, cliOutput, false, {
        nacl: true,
        state: false,
        cache: true,
        staticResources: true,
        credentials: true,
        serviceConfig: true,
      }).execute()).toBe(CliExitCode.UserInputError)
      expect(core.loadLocalWorkspace).not.toHaveBeenCalled()
      expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
      expect(cliOutput.stderr.content.search('Cannot clear static resources without clearing the state, cache and nacls')).toBeGreaterThanOrEqual(0)
    })

    it('should prompt user and continue if yes', async () => {
      expect(await command('.', mockCliTelemetry, cliOutput, false, {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
        serviceConfig: true,
      }).execute()).toBe(CliExitCode.Success)
      expect(core.loadLocalWorkspace).toHaveBeenCalled()
      expect(callbacks.getUserBooleanInput).toHaveBeenCalledWith('Do you want to perform these actions?')
      expect(core.cleanWorkspace).toHaveBeenCalledWith(lastWorkspace, {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
        serviceConfig: true,
      })

      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toBeDefined()
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toBeDefined()
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toBeUndefined()

      expect(cliOutput.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
      expect(cliOutput.stdout.content.search('Finished cleaning')).toBeGreaterThan(0)
    })

    it('should exit cleanly on error', async () => {
      jest.spyOn(core, 'cleanWorkspace').mockImplementationOnce(
        () => { throw new Error('something bad happened') }
      )
      expect(await command('.', mockCliTelemetry, cliOutput, false, {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
        serviceConfig: true,
      }).execute()).toBe(CliExitCode.AppError)
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toBeDefined()
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toBeDefined()

      expect(cliOutput.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
      expect(cliOutput.stderr.content.search('Error encountered while cleaning')).toBeGreaterThan(0)
    })
  })

  describe('with force flag', () => {
    it('should clean without prompting user', async () => {
      jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(
        () => Promise.resolve(false)
      )

      expect(await command('.', mockCliTelemetry, cliOutput, true, {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
        serviceConfig: true,
      }).execute()).toBe(CliExitCode.Success)
      expect(core.loadLocalWorkspace).toHaveBeenCalled()
      expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
      expect(core.cleanWorkspace).toHaveBeenCalledWith(lastWorkspace, {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
        serviceConfig: true,
      })
      expect(cliOutput.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
      expect(cliOutput.stdout.content.search('Finished cleaning')).toBeGreaterThan(0)
    })
  })
})
