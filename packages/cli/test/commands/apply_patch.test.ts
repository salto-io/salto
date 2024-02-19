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
import { Element, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { calculatePatch } from '@salto-io/core'
import { merger, updateElementsWithAlternativeAccount } from '@salto-io/workspace'
import * as mocks from '../mocks'
import { applyPatchAction } from '../../src/commands/apply_patch'
import { CliExitCode } from '../../src/types'

jest.mock('@salto-io/core', () => {
  const actual = jest.requireActual('@salto-io/core')
  return {
    ...actual,
    calculatePatch: jest.fn().mockImplementation(actual.calculatePatch),
  }
})

const mockCalculatePatch = calculatePatch as jest.MockedFunction<typeof calculatePatch>

describe('apply-patch command', () => {
  const commandName = 'apply-patch'
  let workspace: mocks.MockWorkspace
  let baseElements: Element[]
  let cliCommandArgs: mocks.MockCommandArgs
  beforeEach(async () => {
    baseElements = mocks.elements()
    await updateElementsWithAlternativeAccount(baseElements, 'salesforce', 'salto')

    const cliArgs = mocks.mockCliArgs()
    cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
    workspace = mocks.mockWorkspace({
      envs: ['env1', 'env2'],
      accounts: ['salesforce'],
      getElements: () => baseElements,
    })
  })
  describe('when there is a difference between the folders', () => {
    let exitCode: CliExitCode
    let originalInstance: InstanceElement
    let updatedInstance: InstanceElement
    let newInstance: InstanceElement
    beforeEach(async () => {
      const type = baseElements[3] as ObjectType
      originalInstance = baseElements[4] as InstanceElement
      updatedInstance = originalInstance.clone()
      updatedInstance.value.newVal = 'asd'
      newInstance = new InstanceElement('new', type, { val: 1 }, ['path'])
      const modifyInstanceChanges = detailedCompare(originalInstance, updatedInstance)
      const baseChange = toChange({ after: newInstance })
      const additionChange = {
        ...baseChange,
        id: newInstance.elemID,
        baseChange,
      }
      mockCalculatePatch.mockResolvedValue({
        changes: [
          ...modifyInstanceChanges.map(c => ({ change: c, serviceChanges: [c] })),
          { change: additionChange, serviceChanges: [additionChange] },
        ],
        mergeErrors: [],
        fetchErrors: [],
        success: true,
        updatedConfig: {},
      })

      exitCode = await applyPatchAction({
        ...cliCommandArgs,
        input: {
          fromDir: 'a',
          toDir: 'b',
          updateStateInEnvs: ['env2'],
          targetEnvs: ['env1', 'env2'],
          accountName: 'salesforce',
          mode: 'default',
        },
        workspace,
      })
    })
    it('should flush the workspace and succeed', () => {
      expect(workspace.flush).toHaveBeenCalled()
      expect(exitCode).toEqual(CliExitCode.Success)
    })
    it('should update the state in the requested environment', async () => {
      const updatedInstanceFromState = await workspace.state('env2').get(updatedInstance.elemID)
      expect(updatedInstanceFromState.value).toEqual(updatedInstance.value)
      const newInstanceFromState = await workspace.state('env2').get(newInstance.elemID)
      expect(newInstanceFromState).toBeDefined()
      expect(newInstanceFromState.value).toEqual(newInstance.value)
    })
    it('should not update state in other environments', async () => {
      const instFromState = await workspace.state('env1').get(updatedInstance.elemID)
      expect(instFromState.value).toEqual(originalInstance.value)
      expect(await workspace.state('env1').has(newInstance.elemID)).toBeFalsy()
    })
  })
  describe('when there is no difference between the folders', () => {
    let exitCode: CliExitCode
    beforeEach(async () => {
      mockCalculatePatch.mockResolvedValue({
        changes: [],
        mergeErrors: [],
        fetchErrors: [],
        success: true,
        updatedConfig: {},
      })
      exitCode = await applyPatchAction({
        ...cliCommandArgs,
        input: {
          fromDir: 'a',
          toDir: 'b',
          accountName: 'salesforce',
          mode: 'default',
        },
        workspace,
      })
    })
    it('should succeed', () => {
      expect(exitCode).toEqual(CliExitCode.Success)
    })
  })
  describe('when target envs do not exist', () => {
    let exitCode: CliExitCode
    beforeEach(async () => {
      exitCode = await applyPatchAction({
        ...cliCommandArgs,
        input: {
          fromDir: 'a',
          toDir: 'b',
          targetEnvs: ['no_such_env'],
          accountName: 'salesforce',
          mode: 'default',
        },
        workspace,
      })
    })
    it('should fail', () => {
      expect(exitCode).toEqual(CliExitCode.UserInputError)
    })
  })
  describe('when there are conflicting changes', () => {
    let exitCode: CliExitCode
    beforeEach(async () => {
      const unchangedEmployeeType = baseElements[3] as ObjectType
      const fromDirEmployeeType = unchangedEmployeeType.clone()
      const toDirEmployeeType = unchangedEmployeeType.clone()
      fromDirEmployeeType.annotations.conflict = 'from'
      toDirEmployeeType.annotations.conflict = 'to'
      const modifyTypeChanges = detailedCompare(fromDirEmployeeType, toDirEmployeeType)
      const pendingChange = detailedCompare(unchangedEmployeeType, toDirEmployeeType)
      mockCalculatePatch.mockResolvedValue({
        changes: [
          { change: modifyTypeChanges[0], serviceChanges: [modifyTypeChanges[0]], pendingChanges: [pendingChange[0]] },
        ],
        mergeErrors: [],
        fetchErrors: [],
        success: true,
        updatedConfig: {},
      })
      exitCode = await applyPatchAction({
        ...cliCommandArgs,
        input: {
          fromDir: 'a',
          toDir: 'b',
          targetEnvs: ['env1', 'env2'],
          accountName: 'salesforce',
          mode: 'default',
        },
        workspace,
      })
    })
    it('should fail', () => {
      expect(exitCode).toEqual(CliExitCode.AppError)
    })
    it('should not flush changes to any environment', () => {
      expect(workspace.flush).not.toHaveBeenCalled()
    })
  })
  describe('when there are merge errors', () => {
    let exitCode: CliExitCode
    beforeEach(async () => {
      const employeeType = baseElements[3] as ObjectType
      mockCalculatePatch.mockResolvedValue({
        changes: [],
        mergeErrors: [
          {
            error: new merger.DuplicateAnnotationError({
              elemID: employeeType.elemID,
              key: 'conflict',
              newValue: 'to',
              existingValue: 'from',
            }),
            elements: [employeeType],
          },
        ],
        fetchErrors: [],
        success: true,
        updatedConfig: {},
      })
      exitCode = await applyPatchAction({
        ...cliCommandArgs,
        input: {
          fromDir: 'a',
          toDir: 'b',
          targetEnvs: ['env1', 'env2'],
          accountName: 'salesforce',
          mode: 'default',
        },
        workspace,
      })
    })
    it('should fail', () => {
      expect(exitCode).toEqual(CliExitCode.AppError)
    })
    it('should not flush changes to any environment', () => {
      expect(workspace.flush).not.toHaveBeenCalled()
    })
  })
})
