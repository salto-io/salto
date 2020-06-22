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
import _ from 'lodash'
import moment from 'moment'
import inquirer from 'inquirer'
import { DetailedChange } from '@salto-io/adapter-api'
import { Workspace } from '@salto-io/workspace'
import { FetchChange } from '@salto-io/core'
import { Spinner } from '../../src/types'
import { validateWorkspace, loadWorkspace, updateWorkspace, MAX_DETAIL_CHANGES_TO_LOG, updateStateOnly } from '../../src/workspace/workspace'
import { MockWriteStream, dummyChanges, detailedChange, mockErrors, mockFunction } from '../mocks'

const mockWsFunctions = {
  services: mockFunction<Workspace['services']>().mockReturnValue(['salesforce']),
  envs: mockFunction<Workspace['envs']>().mockReturnValue(['default']),
  currentEnv: mockFunction<Workspace['currentEnv']>().mockReturnValue('default'),
  errors: mockFunction<Workspace['errors']>().mockResolvedValue(mockErrors([])),
  updateNaclFiles: mockFunction<Workspace['updateNaclFiles']>(),
  isEmpty: mockFunction<Workspace['isEmpty']>(),
  flush: mockFunction<Workspace['flush']>(),
  transformError: mockFunction<Workspace['transformError']>().mockImplementation(
    error => Promise.resolve({ ...error, sourceFragments: [] })
  ),
  getStateRecency: mockFunction<Workspace['getStateRecency']>().mockResolvedValue({
    serviceName: 'salesforce',
    date: new Date(),
    status: 'Valid',
  }),
}

const mockWs = mockWsFunctions as unknown as Workspace
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  loadLocalWorkspace: jest.fn().mockImplementation(() => mockWs),
}))
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ userInput: false }),
}))
describe('workspace', () => {
  let cliOutput: { stderr: MockWriteStream; stdout: MockWriteStream }

  beforeEach(() => {
    cliOutput = { stderr: new MockWriteStream(), stdout: new MockWriteStream() }
    Object.values(mockWsFunctions).forEach(mock => mock.mockClear())
  })

  describe('error validation', () => {
    describe('when there are no errors', () => {
      it('returns true', async () => {
        const wsValid = (await validateWorkspace(mockWs)).status
        expect(wsValid).toBe('Valid')
      })
    })
    describe('when there are errors', () => {
      it('returns true if there are only warnings', async () => {
        mockWsFunctions.errors.mockResolvedValueOnce(mockErrors([
          { message: 'Error', severity: 'Warning' },
          { message: 'Error2', severity: 'Warning' },
        ]))

        const wsValid = (await validateWorkspace(mockWs)).status
        expect(wsValid).toBe('Warning')
      })

      it('returns false if there is at least one sever error', async () => {
        mockWsFunctions.errors.mockResolvedValueOnce(mockErrors([
          { message: 'Error', severity: 'Warning' },
          { message: 'Error2', severity: 'Error' },
        ]))

        const wsValid = (await validateWorkspace(mockWs)).status
        expect(wsValid).toBe('Error')
      })
    })
  })

  describe('loadWorkspace', () => {
    let spinner: Spinner
    let now: number
    const mockPrompt = inquirer.prompt as jest.Mock
    beforeEach(() => {
      now = Date.now()
      jest.spyOn(Date, 'now').mockImplementation(() => now)
      // Clear to reset the function calls count
      mockPrompt.mockClear()
      spinner = {
        fail: jest.fn(),
        succeed: jest.fn(),
      }
    })
    it('marks spinner as success in case there are no errors', async () => {
      await loadWorkspace('', cliOutput, { spinnerCreator: () => spinner, force: true })

      expect(cliOutput.stdout.content).toBe('')
      expect(cliOutput.stderr.content).toBe('')
      expect(spinner.succeed).toHaveBeenCalled()
    })

    it('marks spinner as success in case of warning', async () => {
      mockWsFunctions.errors.mockResolvedValueOnce(mockErrors([
        { message: 'Error BLA', severity: 'Warning' },
      ]))
      await loadWorkspace('', cliOutput, { spinnerCreator: () => spinner, force: true })

      expect(cliOutput.stdout.content).toContain('Error BLA')
      expect(spinner.succeed).toHaveBeenCalled()
    })

    it('marks spinner as failed in case of error', async () => {
      mockWsFunctions.errors.mockResolvedValueOnce(mockErrors([
        { message: 'Error BLA', severity: 'Error' },
      ]))
      await loadWorkspace('', cliOutput, { spinnerCreator: () => spinner, force: true })

      expect(cliOutput.stderr.content).toContain('Error BLA')
      expect(spinner.fail).toHaveBeenCalled()
    })

    it('prints the state recency when told to do so', async () => {
      const durationAfterLastModificationMs = 1000 * 60 * 60 * 8 // 8 hours
      mockWsFunctions.getStateRecency.mockResolvedValueOnce({
        date: new Date(now - durationAfterLastModificationMs),
        status: 'Valid',
        serviceName: 'salesforce',
      })
      await loadWorkspace('', cliOutput, { force: true, printStateRecency: true, spinnerCreator: () => spinner })
      expect(cliOutput.stdout.content).toContain(
        moment.duration(durationAfterLastModificationMs).humanize()
      )
    })

    it('prints that the state does not exist', async () => {
      mockWsFunctions.getStateRecency.mockResolvedValueOnce(
        { date: undefined, status: 'Nonexistent', serviceName: 'salesforce' }
      )
      await loadWorkspace('', cliOutput, { force: true, printStateRecency: true, spinnerCreator: () => spinner })
      expect(cliOutput.stdout.content).toContain('unknown')
    })

    it('does not always print the state recency', async () => {
      await loadWorkspace('', cliOutput, { spinnerCreator: () => spinner, force: true })
      expect(cliOutput.stdout.content).toBe('')
    })

    it('prompts user when the state is too old and recommend recency is enabled', async () => {
      mockWsFunctions.getStateRecency.mockResolvedValueOnce(
        { date: new Date(now), status: 'Old', serviceName: 'salesforce' }
      )
      await loadWorkspace('', cliOutput, { spinnerCreator: () => spinner, recommendStateRecency: true })
      expect(mockPrompt).toHaveBeenCalledTimes(1)
    })

    it('prompts user when the state doesn\'t exist and recommend recency is enabled', async () => {
      mockWsFunctions.getStateRecency.mockResolvedValueOnce(
        { date: new Date(now), status: 'Nonexistent', serviceName: 'salesforce' }
      )
      await loadWorkspace('', cliOutput, { spinnerCreator: () => spinner, recommendStateRecency: true })
      expect(mockPrompt).toHaveBeenCalledTimes(1)
    })

    it('does not prompt user when the state is valid and recommend recency is enabled', async () => {
      mockWsFunctions.getStateRecency.mockResolvedValueOnce(
        { date: new Date(now), status: 'Valid', serviceName: 'salesforce' }
      )
      await loadWorkspace('', cliOutput, { spinnerCreator: () => spinner, recommendStateRecency: true })
      expect(mockPrompt).not.toHaveBeenCalled()
    })
  })

  describe('updateWorkspace', () => {
    it('no changes', async () => {
      const result = await updateWorkspace(mockWs, cliOutput, [])
      expect(result).toBeTruthy()
    })

    it('with changes', async () => {
      const result = await updateWorkspace(mockWs, cliOutput,
        dummyChanges.map((change: DetailedChange): FetchChange =>
          ({ change, serviceChange: change })))
      expect(result).toBeTruthy()
      expect(mockWs.updateNaclFiles).toHaveBeenCalledWith(dummyChanges, undefined)
      expect(mockWs.flush).toHaveBeenCalledTimes(1)
    })

    it('with more changes than max changes to log', async () => {
      const changes = _.fill(Array(MAX_DETAIL_CHANGES_TO_LOG + 1),
        detailedChange('add', ['adapter', 'dummy'], undefined, 'after-add-dummy1'))
      const result = await updateWorkspace(mockWs, cliOutput,
        changes.map((change: DetailedChange): FetchChange =>
          ({ change, serviceChange: change })))
      expect(result).toBeTruthy()
      expect(mockWs.updateNaclFiles).toHaveBeenCalledWith(changes, undefined)
      expect(mockWs.flush).toHaveBeenCalledTimes(1)
    })

    it('with validation errors', async () => {
      mockWsFunctions.errors.mockResolvedValue(mockErrors([
        { message: 'Error BLA', severity: 'Error' },
      ]))
      const result = await updateWorkspace(mockWs, cliOutput,
        dummyChanges.map((change: DetailedChange): FetchChange =>
          ({ change, serviceChange: change })))
      expect(result).toBe(false)
      expect(mockWs.updateNaclFiles).toHaveBeenCalledWith(dummyChanges, undefined)
      expect(mockWs.flush).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateStateOnly', () => {
    it('should return true if ws flush goes without errors', async () => {
      const res = await updateStateOnly(mockWs, [])
      expect(mockWsFunctions.flush).toHaveBeenCalledTimes(1)
      expect(res).toBe(true)
    })

    it('should return false if workspace flush causes an error', async () => {
      mockWsFunctions.flush.mockRejectedValue('err')
      const res = await updateStateOnly(mockWs, [])
      expect(mockWsFunctions.flush).toHaveBeenCalledTimes(1)
      expect(res).toBeFalsy()
    })
  })
})
