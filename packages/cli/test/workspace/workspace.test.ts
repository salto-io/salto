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
import _ from 'lodash'
import { FetchChange } from '@salto-io/core'
import { Workspace, state } from '@salto-io/workspace'
import { mockFunction } from '@salto-io/test-utils'
import { EventEmitter } from 'pietile-eventemitter'
import {
  validateWorkspace,
  updateWorkspace,
  MAX_DETAIL_CHANGES_TO_LOG,
  updateStateOnly,
  applyChangesToWorkspace,
} from '../../src/workspace/workspace'
import { MockWriteStream, dummyChanges, detailedChange, mockErrors, getMockTelemetry } from '../mocks'
import { getCliTelemetry } from '../../src/telemetry'

import { version } from '../../src/generated/version.json'

const mockWsFunctions = {
  accounts: mockFunction<Workspace['accounts']>().mockReturnValue(['salesforce']),
  envs: mockFunction<Workspace['envs']>().mockReturnValue(['default']),
  currentEnv: mockFunction<Workspace['currentEnv']>().mockReturnValue('default'),
  errors: mockFunction<Workspace['errors']>().mockResolvedValue(mockErrors([])),
  updateNaclFiles: mockFunction<Workspace['updateNaclFiles']>().mockResolvedValue({
    naclFilesChangesCount: 0,
    stateOnlyChangesCount: 0,
  }),
  isEmpty: mockFunction<Workspace['isEmpty']>().mockResolvedValue(false),
  flush: mockFunction<Workspace['flush']>(),
  transformError: mockFunction<Workspace['transformError']>().mockImplementation(error =>
    Promise.resolve({ ...error, sourceLocations: [] }),
  ),
  getTotalSize: mockFunction<Workspace['getTotalSize']>(),
  getStateRecency: mockFunction<Workspace['getStateRecency']>().mockResolvedValue({
    accountName: 'salesforce',
    serviceName: 'salesforce',
    date: new Date(),
    status: 'Valid',
  }),
  state: mockFunction<Workspace['state']>().mockReturnValue({
    getStateSaltoVersion: () => Promise.resolve(version),
  } as state.State),
}

const mockWs = mockWsFunctions as unknown as Workspace
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
  loadLocalWorkspace: jest.fn().mockImplementation(() => mockWs),
}))
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ userInput: 'n' }),
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
        mockWsFunctions.errors.mockResolvedValueOnce(
          mockErrors([
            { message: 'Error', severity: 'Warning' },
            { message: 'Error2', severity: 'Warning' },
          ]),
        )

        const wsValid = (await validateWorkspace(mockWs)).status
        expect(wsValid).toBe('Warning')
      })

      it('returns false if there is at least one sever error', async () => {
        mockWsFunctions.errors.mockResolvedValueOnce(
          mockErrors([
            { message: 'Error', severity: 'Warning' },
            { message: 'Error2', severity: 'Error' },
          ]),
        )

        const wsValid = (await validateWorkspace(mockWs)).status
        expect(wsValid).toBe('Error')
      })
    })
  })

  describe('updateWorkspace', () => {
    it('no changes', async () => {
      const result = await updateWorkspace({ workspace: mockWs, output: cliOutput, changes: [] })
      expect(result).toBeTruthy()
    })

    it('with changes', async () => {
      const result = await updateWorkspace({
        workspace: mockWs,
        output: cliOutput,
        changes: dummyChanges.map(change => ({ change, serviceChanges: [change] })),
      })
      expect(result).toBeTruthy()
      expect(mockWs.updateNaclFiles).toHaveBeenCalledWith(dummyChanges, 'default')
      expect(mockWs.flush).toHaveBeenCalledTimes(1)
    })

    it('with more changes than max changes to log', async () => {
      const changes = _.fill(
        Array(MAX_DETAIL_CHANGES_TO_LOG + 1),
        detailedChange('add', ['adapter', 'dummy'], undefined, 'after-add-dummy1'),
      )
      const result = await updateWorkspace({
        workspace: mockWs,
        output: cliOutput,
        changes: changes.map(change => ({ change, serviceChanges: [change] })),
      })
      expect(result).toBeTruthy()
      expect(mockWs.updateNaclFiles).toHaveBeenCalledWith(changes, 'default')
      expect(mockWs.flush).toHaveBeenCalledTimes(1)
    })

    it('with validation errors', async () => {
      mockWsFunctions.errors.mockResolvedValueOnce(mockErrors([{ message: 'Error BLA', severity: 'Error' }]))
      const result = await updateWorkspace({
        workspace: mockWs,
        output: cliOutput,
        changes: dummyChanges.map(change => ({ change, serviceChanges: [change] })),
      })
      expect(result.success).toBe(false)
      expect(mockWs.updateNaclFiles).toHaveBeenCalledWith(dummyChanges, 'default')
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
      mockWsFunctions.flush.mockRejectedValueOnce('err')
      const res = await updateStateOnly(mockWs, [])
      expect(mockWsFunctions.flush).toHaveBeenCalledTimes(1)
      expect(res).toBeFalsy()
    })
  })

  describe('applyChangesToWorkspace', () => {
    type ApproveChangesCB = Parameters<typeof applyChangesToWorkspace>[0]['approveChangesCallback']

    let changes: FetchChange[]
    let approveChangesCallback: jest.MockedFunction<ApproveChangesCB>

    beforeEach(() => {
      changes = dummyChanges.map(change => ({ change, serviceChanges: [change] }))
      approveChangesCallback = mockFunction<ApproveChangesCB>().mockResolvedValue(changes)
    })
    it('should apply changes and return true', async () => {
      const res = await applyChangesToWorkspace({
        workspace: mockWs,
        changes,
        mode: 'default',
        force: true,
        shouldCalcTotalSize: true,
        applyProgress: new EventEmitter(),
        output: { stdout: new MockWriteStream(), stderr: new MockWriteStream() },
        approveChangesCallback,
        cliTelemetry: getCliTelemetry(getMockTelemetry(), 'fetch'),
      })
      expect(res).toBeTruthy()
    })
    it('should return false on error', async () => {
      mockWsFunctions.errors.mockResolvedValue(mockErrors([{ message: 'Error BLA', severity: 'Error' }]))
      const res = await applyChangesToWorkspace({
        workspace: mockWs,
        changes,
        mode: 'default',
        force: true,
        shouldCalcTotalSize: false,
        applyProgress: new EventEmitter(),
        output: { stdout: new MockWriteStream(), stderr: new MockWriteStream() },
        approveChangesCallback,
        cliTelemetry: getCliTelemetry(getMockTelemetry(), 'fetch'),
      })
      expect(res).toBeFalsy()
    })
    it('should prompt the user when ws is not empty', async () => {
      await applyChangesToWorkspace({
        workspace: mockWs,
        changes,
        mode: 'default',
        force: false,
        shouldCalcTotalSize: false,
        applyProgress: new EventEmitter(),
        output: { stdout: new MockWriteStream(), stderr: new MockWriteStream() },
        approveChangesCallback,
        cliTelemetry: getCliTelemetry(getMockTelemetry(), 'fetch'),
      })
      expect(approveChangesCallback).toHaveBeenCalled()
    })
    it('should not prompt the user when ws is empty', async () => {
      mockWsFunctions.isEmpty.mockResolvedValueOnce(true)
      await applyChangesToWorkspace({
        workspace: mockWs,
        changes,
        mode: 'default',
        force: true,
        shouldCalcTotalSize: false,
        applyProgress: new EventEmitter(),
        output: { stdout: new MockWriteStream(), stderr: new MockWriteStream() },
        approveChangesCallback,
        cliTelemetry: getCliTelemetry(getMockTelemetry(), 'fetch'),
      })
      expect(approveChangesCallback).not.toHaveBeenCalled()
    })
    it('should not prompt the user when force is selected', async () => {
      await applyChangesToWorkspace({
        workspace: mockWs,
        changes,
        mode: 'default',
        force: true,
        shouldCalcTotalSize: false,
        applyProgress: new EventEmitter(),
        output: { stdout: new MockWriteStream(), stderr: new MockWriteStream() },
        approveChangesCallback,
        cliTelemetry: getCliTelemetry(getMockTelemetry(), 'fetch'),
      })
      expect(approveChangesCallback).not.toHaveBeenCalled()
    })
  })
})
