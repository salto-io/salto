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
import { command } from '../../src/commands/preview'
import {
  preview, MockWriteStream, MockTelemetry, mockLoadWorkspaceEnvironment,
  withoutEnvironmentParam, withEnvironmentParam, getMockTelemetry, mockSpinnerCreator,
  mockLoadWorkspace as mockLoadWorkspaceGeneral,
} from '../mocks'
import { SpinnerCreator, Spinner, CliExitCode, CliTelemetry } from '../../src/types'
import * as workspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'


const mockPreview = preview
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  preview: jest.fn().mockImplementation(() => mockPreview()),
}))
jest.mock('../../src/workspace/workspace')

const commandName = 'preview'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
}

describe('preview command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let mockTelemetry: MockTelemetry
  let mockCliTelemetry: CliTelemetry
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(baseDir => {
    if (baseDir === 'errdir') {
      return {
        workspace: {
          ...mockLoadWorkspaceGeneral(baseDir),
          hasErrors: () => true,
          errors: () => ({
            strings: () => ['Error', 'Error'],
          }),
        },
        errored: true,
      }
    }
    return {
      workspace: {
        ...mockLoadWorkspaceGeneral(baseDir),
        hasErrors: () => false,
      },
      errored: false,
    }
  })

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    mockTelemetry = getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'preview')
    spinners = []
    spinnerCreator = mockSpinnerCreator(spinners)
  })

  describe('when the workspace loads successfully', () => {
    beforeEach(async () => {
      await command('', mockCliTelemetry, cliOutput, spinnerCreator, services, undefined, '').execute()
    })

    it('should load the workspace', async () => {
      expect(mockLoadWorkspace).toHaveBeenCalled()
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).not.toBeUndefined()
    })

    it('should print summary', async () => {
      expect(cliOutput.stdout.content).toMatch(/Impacts.*2 types and 1 instance/)
    })

    it('should find all elements', async () => {
      expect(cliOutput.stdout.content).toContain('lead')
      expect(cliOutput.stdout.content).toContain('account')
      expect(cliOutput.stdout.content).toContain('salto.employee.instance.test')
    })

    it('should find instance change', async () => {
      expect(cliOutput.stdout.content).toMatch(/M.*name/)
    })

    it('should have started spinner and it should succeed (and not fail)', async () => {
      expect(spinnerCreator).toHaveBeenCalled()
      expect(spinners[0].fail).not.toHaveBeenCalled()
      expect(spinners[0].succeed).toHaveBeenCalled()
      expect((spinners[0].succeed as jest.Mock).mock.calls[0][0]).toContain('Calculated')
    })
  })

  describe('when the workspace fails to load', () => {
    let result: number
    beforeEach(async () => {
      result = await command('errdir', mockCliTelemetry, cliOutput, spinnerCreator, services, undefined, '').execute()
    })

    it('should fail', () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(mockTelemetry.getEvents()).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
    })

    it('should not start the preview spinner', () => {
      expect(spinners[1]).toBeUndefined()
    })
  })
  describe('Env flag for command', () => {
    beforeEach(() => {
      mockLoadWorkspace.mockImplementation(mockLoadWorkspaceEnvironment)
      mockLoadWorkspace.mockClear()
    })

    it('should use current env when env is not provided', async () => {
      await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        services
      ).execute()
      expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
      expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual(
        withoutEnvironmentParam
      )
    })
    it('should use provided env', async () => {
      await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        services,
        undefined,
        withEnvironmentParam
      ).execute()
      expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
      expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual(
        withEnvironmentParam
      )
    })
  })
})
