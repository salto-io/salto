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
import { Workspace, FetchChange, DetailedChange } from 'salto'
import { Spinner } from '../src/types'
import { validateWorkspace, loadWorkspace, updateWorkspace } from '../src/workspace'
import { MockWriteStream, dummyChanges } from './mocks'

const mockWs = {
  hasErrors: jest.fn().mockResolvedValue(false),
  getWorkspaceErrors: jest.fn(),
  updateBlueprints: jest.fn(),
  isEmpty: jest.fn(),
  flush: jest.fn(),
} as unknown as Workspace
jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  Workspace: jest.fn().mockImplementation(() => mockWs),
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], services: ['salesforce'], cacheLocation: '' })
  ),
}))
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockImplementation(() => Promise.resolve({ 0: 'yes', 1: 'no' })),
}))
describe('workspace', () => {
  let cliOutput: { stderr: MockWriteStream; stdout: MockWriteStream }

  beforeEach(() => {
    cliOutput = { stderr: new MockWriteStream(), stdout: new MockWriteStream() }
  })

  describe('error validation', () => {
    describe('when there are no errors', () => {
      it('returns true', async () => {
        mockWs.hasErrors = jest.fn().mockResolvedValue(false)
        const wsValid = await validateWorkspace(mockWs, cliOutput)
        expect(mockWs.hasErrors).toHaveBeenCalled()
        expect(wsValid).toBe('Valid')
      })
    })
    describe('when there are errors', () => {
      it('returns true if there are only warnings', async () => {
        mockWs.hasErrors = jest.fn().mockResolvedValue(true)
        mockWs.getWorkspaceErrors = jest.fn().mockImplementation(() => (
          [{
            sourceFragments: [],
            message: 'Error',
            severity: 'Warning',
          },
          {
            sourceFragments: [],
            message: 'Error2',
            severity: 'Warning',
          }]
        ))

        const wsValid = await validateWorkspace(mockWs, cliOutput)
        expect(mockWs.hasErrors).toHaveBeenCalled()
        expect(mockWs.getWorkspaceErrors).toHaveBeenCalled()
        expect(wsValid).toBe('Warning')
      })

      it('returns false if there is at least one sever error', async () => {
        mockWs.hasErrors = jest.fn().mockResolvedValue(true)
        mockWs.getWorkspaceErrors = jest.fn().mockImplementation(() => (
          [{
            sourceFragments: [],
            error: 'Error',
            severity: 'Warning',
          },
          {
            sourceFragments: [],
            error: 'Error2',
            severity: 'Error',
          }]
        ))

        const wsValid = await validateWorkspace(mockWs, cliOutput)
        expect(mockWs.hasErrors).toHaveBeenCalled()
        expect(mockWs.getWorkspaceErrors).toHaveBeenCalled()
        expect(wsValid).toBe('Error')
      })
    })
  })

  describe('loadWorkspace', () => {
    let spinner: Spinner
    beforeEach(() => {
      spinner = {
        fail: jest.fn().mockImplementation(() => undefined),
        succeed: jest.fn().mockImplementation(() => undefined),
      }
    })
    it('mark spinner as success in case there are no errors', async () => {
      mockWs.hasErrors = jest.fn().mockResolvedValue(false)
      mockWs.getWorkspaceErrors = jest.fn().mockImplementation(() => ([]))
      await loadWorkspace('', cliOutput, () => spinner)

      expect(cliOutput.stdout.content).toBe('')
      expect(cliOutput.stderr.content).toBe('')
      expect(spinner.succeed).toHaveBeenCalled()
    })

    it('mark spinner as success in case of warning', async () => {
      mockWs.hasErrors = jest.fn().mockResolvedValue(true)
      mockWs.getWorkspaceErrors = jest.fn().mockImplementation(() => ([{
        sourceFragments: [],
        message: 'Error BLA',
        severity: 'Warning',
      }]))
      await loadWorkspace('', cliOutput, () => spinner)

      expect(cliOutput.stdout.content).toContain('Error BLA')
      expect(spinner.succeed).toHaveBeenCalled()
    })

    it('mark spinner as failed in case of error', async () => {
      mockWs.hasErrors = jest.fn().mockResolvedValue(true)
      mockWs.getWorkspaceErrors = jest.fn().mockImplementation(() => ([{
        sourceFragments: [],
        message: 'Error BLA',
        severity: 'Error',
      }]))
      await loadWorkspace('', cliOutput, () => spinner)

      expect(cliOutput.stderr.content).toContain('Error BLA')
      expect(spinner.fail).toHaveBeenCalled()
    })
  })

  describe('updateWorkspace', () => {
    it('no changes', async () => {
      const result = await updateWorkspace(mockWs, cliOutput)
      expect(result).toBeTruthy()
    })

    it('with changes', async () => {
      mockWs.hasErrors = jest.fn().mockResolvedValue(false)
      const result = await updateWorkspace(mockWs, cliOutput,
        ...dummyChanges.map((change: DetailedChange): FetchChange =>
          ({ change, serviceChange: change })))
      expect(result).toBeTruthy()
      expect(mockWs.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
      expect(mockWs.flush).toHaveBeenCalledTimes(1)
      expect(mockWs.hasErrors).toHaveBeenCalled()
    })
  })
})
