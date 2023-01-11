/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { loadElementsFromFolder } from '@salto-io/salesforce-adapter'
import { updateElementsWithAlternativeAccount } from '@salto-io/workspace'
import * as mocks from '../mocks'
import { fetchDiffAction } from '../../src/commands/fetch_diff'
import { CliExitCode } from '../../src/types'

jest.mock('@salto-io/salesforce-adapter', () => {
  const actual = jest.requireActual<{ loadElementsFromFolder: typeof loadElementsFromFolder }>('@salto-io/salesforce-adapter')
  return {
    ...actual,
    loadElementsFromFolder: jest.fn().mockImplementation(actual.loadElementsFromFolder),
  }
})

const mockLoadElementsFromFolder = (
  loadElementsFromFolder as jest.MockedFunction<typeof loadElementsFromFolder>
)

describe('fetch-diff command', () => {
  const commandName = 'fetch-diff'
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
      const beforeElements = [originalInstance]
      const afterElements = [updatedInstance, newInstance]
      // Response for env1
      mockLoadElementsFromFolder
        .mockResolvedValueOnce(beforeElements)
        .mockResolvedValueOnce(afterElements)
      // Response for env2
      mockLoadElementsFromFolder
        .mockResolvedValueOnce(beforeElements)
        .mockResolvedValueOnce(afterElements)

      exitCode = await fetchDiffAction({
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
      mockLoadElementsFromFolder.mockResolvedValue(baseElements)
      exitCode = await fetchDiffAction({
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
      exitCode = await fetchDiffAction({
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
      const unchangedEmployeeType = baseElements[3]
      const fromDirEmployeeType = unchangedEmployeeType.clone()
      const toDirEmployeeType = unchangedEmployeeType.clone()
      fromDirEmployeeType.annotations.conflict = 'from'
      toDirEmployeeType.annotations.conflict = 'to'
      // Have a regular change (no conflict) on the first env
      mockLoadElementsFromFolder
        .mockResolvedValueOnce([unchangedEmployeeType])
        .mockResolvedValueOnce([toDirEmployeeType])
      // Have a conflicting change on the second env
      mockLoadElementsFromFolder
        .mockResolvedValueOnce([fromDirEmployeeType])
        .mockResolvedValueOnce([toDirEmployeeType])

      exitCode = await fetchDiffAction({
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
