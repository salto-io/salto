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
  preview, MockWriteStream, getWorkspaceErrors,
  mockSpinnerCreator, mockLoadConfig,
  transformToWorkspaceError, getMockTelemetry,
  MockTelemetry,
} from '../mocks'
import { SpinnerCreator, Spinner, CliExitCode } from '../../src/types'
import * as workspace from '../../src/workspace'

const mockPreview = preview
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  preview: jest.fn().mockImplementation(() => mockPreview()),
}))
jest.mock('../../src/workspace')

const eventsNames = {
  failure: 'workspace.preview.failure',
  start: 'workspace.preview.start',
  success: 'workspace.preview.success',
}

describe('preview command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let mockTelemetry: MockTelemetry
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(baseDir => {
    if (baseDir === 'errdir') {
      return {
        workspace: {
          hasErrors: () => true,
          errors: {
            strings: () => ['Error', 'Error'],
          },
          getWorkspaceErrors,
          config: mockLoadConfig(baseDir),
          transformToWorkspaceError,
        },
        errored: true,
      }
    }
    return {
      workspace: {
        hasErrors: () => false,
        config: mockLoadConfig(baseDir),
        transformToWorkspaceError,
      },
      errored: false,
    }
  })

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    mockTelemetry = getMockTelemetry()
    spinners = []
    spinnerCreator = mockSpinnerCreator(spinners)
  })

  describe('when the workspace loads successfully', () => {
    beforeEach(async () => {
      await command('', mockTelemetry, cliOutput, spinnerCreator, services).execute()
    })

    it('should load the workspace', async () => {
      expect(mockLoadWorkspace).toHaveBeenCalled()
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).not.toBeUndefined()
    })

    it('should print summary', async () => {
      expect(cliOutput.stdout.content.search(/Impacts.*2 types and 1 instance/)).toBeGreaterThan(0)
    })

    it('should find all elements', async () => {
      expect(cliOutput.stdout.content).toContain('lead')
      expect(cliOutput.stdout.content).toContain('account')
      expect(cliOutput.stdout.content).toContain('salto.employee.instance.test')
    })

    it('should find instance change', async () => {
      expect(cliOutput.stdout.content.search('name: "FirstEmployee" => "PostChange"')).toBeGreaterThan(0)
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
      result = await command('errdir', mockTelemetry, cliOutput, spinnerCreator, services).execute()
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
})
