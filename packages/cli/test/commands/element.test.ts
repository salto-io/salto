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
import open from 'open'
import {
  Element,
  ElemID,
  ObjectType,
  CORE_ANNOTATIONS,
  isInstanceElement,
  InstanceElement,
  isObjectType,
} from '@salto-io/adapter-api'
import { errors, UnresolvedElemIDs, createElementSelector } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { SelectorsError, fixElements } from '@salto-io/core'
import { CliExitCode } from '../../src/types'
import {
  cloneAction,
  moveToEnvsAction,
  moveToCommonAction,
  listUnresolvedAction,
  openAction,
  listAction,
  renameAction,
  printElementAction,
  fixElementsAction,
} from '../../src/commands/element'
import * as mocks from '../mocks'
import * as callbacks from '../../src/callbacks'
import Prompts from '../../src/prompts'
import { formatTargetEnvRequired } from '../../src/formatter'
import { MockWorkspace } from '../mocks'

const { awu } = collections.asynciterable

const mockedList = async (completeFromEnv?: string): Promise<UnresolvedElemIDs> =>
  completeFromEnv !== undefined
    ? Promise.resolve({
        found: [new ElemID('salesforce', 'aaa'), new ElemID('salesforce', 'bbb', 'instance', 'ccc')],
        missing: [],
      })
    : Promise.resolve({
        found: [],
        missing: [new ElemID('salesforce', 'fail')],
      })

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
  fixElements: jest.fn(),
}))

jest.mock('open')
describe('Element command group', () => {
  describe('Clone command', () => {
    const cloneName = 'clone'
    describe('with errored workspace', () => {
      let result: CliExitCode
      beforeAll(async () => {
        const workspace = mocks.mockWorkspace({})
        workspace.errors.mockResolvedValue(mocks.mockErrors([{ severity: 'Error', message: 'some error' }]))
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName),
          input: {
            elementSelector: ['salto.Account'],
            toEnvs: ['inactive'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should fail', async () => {
        expect(result).toBe(CliExitCode.AppError)
      })
    })

    describe('when workspace throws an error on clone', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const workspace = mocks.mockWorkspace({})
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([new ElemID('salto', 'Account')]))
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.flush.mockRejectedValue(new Error('Oy Vey Zmir'))
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: ['salto.Account'],
            toEnvs: ['inactive'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.AppError)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content).toContain('Failed to clone the specified elements to the target environments')
      })
    })

    describe('with invalid element selectors', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let telemetry: mocks.MockTelemetry
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        telemetry = cliArgs.telemetry
        workspace = mocks.mockWorkspace({})
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: ['a.b.c.d'],
            toEnvs: ['inactive'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should not call workspace copyTo', () => {
        expect(workspace.copyTo).not.toHaveBeenCalled()
      })
      it('should not call workspace promote', () => {
        expect(workspace.promote).not.toHaveBeenCalled()
      })
      it('should not call workspace demote', () => {
        expect(workspace.demote).not.toHaveBeenCalled()
      })

      it('should not flush workspace', () => {
        expect(workspace.flush).not.toHaveBeenCalled()
      })

      it('should not send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(0)
      })

      it('should print clone to console', () => {
        expect(output.stderr.content).toContain('Failed to created element ID filters')
      })
    })

    describe('when user answer no', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(() => Promise.resolve(false))

        const cliArgs = mocks.mockCliArgs()
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([selector]))
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['inactive'],
            env: 'active',
            force: false,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })

      it('should not clone', () => {
        expect(workspace.copyTo).not.toHaveBeenCalled()
      })
    })

    describe('valid clone', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      const selector = new ElemID('salto', 'Account')
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([selector]))
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['inactive'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call workspace sync', () => {
        expect(workspace.sync).toHaveBeenCalledWith([selector], {}, ['inactive'])
      })

      it('should flush workspace', () => {
        expect(workspace.flush).toHaveBeenCalled()
      })

      it('should print clone to console', () => {
        expect(output.stdout.content).toBe(`The following configuration elements will be cloned:
  - salto.Account


Cloning the specified elements to inactive.
`)
      })
    })

    describe('clone with invalid target envs', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const selector = new ElemID('salto', 'Account')
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['inactive', 'unknown', 'unknown2'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace: mocks.mockWorkspace({}),
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content).toContain('Unknown target environment')
      })
    })

    describe('clone with invalid env', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const selector = new ElemID('salto', 'Account')
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['inactive', 'unknown'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace: mocks.mockWorkspace({}),
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content).toContain('Unknown target environment')
      })
    })
    describe('clone with empty list as target envs', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const selector = new ElemID('salto', 'Account')
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: [],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace: mocks.mockWorkspace({}),
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content).toContain(formatTargetEnvRequired())
      })
    })
    describe('clone with current env as target env', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const selector = new ElemID('salto', 'Account')
        result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['active'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace: mocks.mockWorkspace({}),
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content).toContain(Prompts.INVALID_ENV_TARGET_CURRENT)
      })
    })

    describe('clone with -to-all-envs params', () => {
      const runClone = async ({
        toEnvs,
        toAllEnvs,
        workspace,
      }: {
        toEnvs?: string[]
        toAllEnvs?: boolean
        workspace?: MockWorkspace
      }): Promise<{ result: CliExitCode; output: mocks.MockCliOutput }> => {
        const cliArgs = mocks.mockCliArgs()
        const { output } = cliArgs
        const selector = new ElemID('salto', 'Account')
        const result = await cloneAction({
          ...mocks.mockCliCommandArgs(cloneName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs,
            toAllEnvs,
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace: workspace || mocks.mockWorkspace({}),
        })
        return { result, output }
      }

      it('should fail receiving both toEnvs and toAllEnvs', async () => {
        const { result, output } = await runClone({ toEnvs: ['env1'], toAllEnvs: true })
        expect(result).toBe(CliExitCode.UserInputError)
        expect(output.stderr.content).toContain(
          "Please specify the target environment(s) by passing exactly one of '--to-envs' and '--to-all-envs' parameters",
        )
      })

      it('should fail not receiving one of toEnvs or toAllEnvs', async () => {
        const { result, output } = await runClone({})
        expect(result).toBe(CliExitCode.UserInputError)
        expect(output.stderr.content).toContain(
          "Please specify the target environment(s) by passing exactly one of '--to-envs' and '--to-all-envs' parameters",
        )
      })

      it('should fail running toAllEnvs with only current env', async () => {
        const workspace = mocks.mockWorkspace({ envs: ['active'] })
        const { result, output } = await runClone({ toAllEnvs: true, workspace })
        expect(result).toBe(CliExitCode.UserInputError)
        expect(output.stderr.content).toContain('The target environments cannot be empty')
      })

      it('should succeed cloning to all envs', async () => {
        const envsToCloneTo = ['env1', 'env2', 'env3']
        const workspace = mocks.mockWorkspace({ envs: ['active', ...envsToCloneTo] })
        const selector = new ElemID('salto', 'Account')
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([selector]))

        const { result, output } = await runClone({ toAllEnvs: true, workspace })
        expect(result).toBe(CliExitCode.Success)
        expect(output.stdout.content).toContain(envsToCloneTo.join(', '))
      })
    })

    describe('allowElementDeletions', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let cliArgs: mocks.MockCliArgs
      let output: mocks.MockCliOutput

      const elemToAdd = new ElemID('salto', 'elemToAdd')
      const elemToRemoveFromEnv2 = new ElemID('salto', 'elemToRemoveFromEnv2')
      const elemToRemoveFromEnv3 = new ElemID('salto', 'elemToRemoveFromEnv3')
      beforeEach(() => {
        workspace = mocks.mockWorkspace({
          envs: ['env1', 'env2', 'env3'],
        })
        cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
      })
      describe('both elements to copy and elements to delete', () => {
        beforeEach(async () => {
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToAdd]))
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToRemoveFromEnv2]))
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToRemoveFromEnv3]))
          result = await cloneAction({
            ...mocks.mockCliCommandArgs(cloneName, cliArgs),
            input: {
              elementSelector: [
                elemToAdd.getFullName(),
                elemToRemoveFromEnv2.getFullName(),
                elemToRemoveFromEnv3.getFullName(),
              ],
              toEnvs: ['env2'],
              env: 'env1',
              force: true,
              allowElementDeletions: true,
            },
            workspace,
          })
        })
        it('should return success code', () => {
          expect(result).toBe(CliExitCode.Success)
        })
        it('should call workspace sync', () => {
          expect(workspace.sync).toHaveBeenCalledWith([elemToAdd], { env2: [elemToRemoveFromEnv2] }, ['env2'])
        })

        it('should flush workspace', () => {
          expect(workspace.flush).toHaveBeenCalled()
        })

        it('should print clone to console', () => {
          expect(output.stdout.content).toBe(`The following configuration elements will be cloned:
  - salto.elemToAdd


The following configuration elements will be deleted from env2:
  - salto.elemToRemoveFromEnv2


Cloning the specified elements to env2.
`)
        })
      })

      describe('only elements to copy', () => {
        beforeEach(async () => {
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToAdd]))
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([]))
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([]))
          result = await cloneAction({
            ...mocks.mockCliCommandArgs(cloneName, cliArgs),
            input: {
              elementSelector: [
                elemToAdd.getFullName(),
                elemToRemoveFromEnv2.getFullName(),
                elemToRemoveFromEnv3.getFullName(),
              ],
              toEnvs: ['env2'],
              env: 'env1',
              force: true,
              allowElementDeletions: true,
            },
            workspace,
          })
        })
        it('should return success code', () => {
          expect(result).toBe(CliExitCode.Success)
        })
        it('should call workspace sync', () => {
          expect(workspace.sync).toHaveBeenCalledWith([elemToAdd], {}, ['env2'])
        })

        it('should flush workspace', () => {
          expect(workspace.flush).toHaveBeenCalled()
        })

        it('should print clone to console', () => {
          expect(output.stdout.content).toBe(`The following configuration elements will be cloned:
  - salto.elemToAdd


Cloning the specified elements to env2.
`)
        })
      })

      describe('only elements to delete', () => {
        beforeEach(async () => {
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([]))
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToRemoveFromEnv2]))
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToRemoveFromEnv3]))
          result = await cloneAction({
            ...mocks.mockCliCommandArgs(cloneName, cliArgs),
            input: {
              elementSelector: [
                elemToAdd.getFullName(),
                elemToRemoveFromEnv2.getFullName(),
                elemToRemoveFromEnv3.getFullName(),
              ],
              toEnvs: ['env2'],
              env: 'env1',
              force: true,
              allowElementDeletions: true,
            },
            workspace,
          })
        })
        it('should return success code', () => {
          expect(result).toBe(CliExitCode.Success)
        })

        it('should call workspace sync', () => {
          expect(workspace.sync).toHaveBeenCalledWith([], { env2: [elemToRemoveFromEnv2] }, ['env2'])
        })

        it('should flush workspace', () => {
          expect(workspace.flush).toHaveBeenCalled()
        })

        it('should print clone to console', () => {
          expect(output.stdout.content).toBe(`The following configuration elements will be deleted from env2:
  - salto.elemToRemoveFromEnv2


Cloning the specified elements to env2.
`)
        })
      })

      describe('nothing to do', () => {
        beforeEach(async () => {
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([]))
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([]))
          workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([]))
          result = await cloneAction({
            ...mocks.mockCliCommandArgs(cloneName, cliArgs),
            input: {
              elementSelector: [
                elemToAdd.getFullName(),
                elemToRemoveFromEnv2.getFullName(),
                elemToRemoveFromEnv3.getFullName(),
              ],
              toEnvs: ['env2'],
              env: 'env1',
              force: true,
              allowElementDeletions: true,
            },
            workspace,
          })
        })
        it('should return success code', () => {
          expect(result).toBe(CliExitCode.Success)
        })

        it('should not call sync', () => {
          expect(workspace.sync).not.toHaveBeenCalled()
        })

        it('should not flush workspace', () => {
          expect(workspace.flush).not.toHaveBeenCalled()
        })

        it('should print clone to console', () => {
          expect(output.stdout.content).toBe(`Did not find any configuration elements that match your criteria.
Nothing to do.
`)
        })
      })
    })
  })

  describe('move-to-envs command', () => {
    const moveToEnvsName = 'move-to-envs'
    describe('when workspace throws an error', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const workspace = mocks.mockWorkspace({})
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([new ElemID('salto', 'Account')]))
        workspace.flush.mockRejectedValue(new Error('Oy Vey Zmir'))
        result = await moveToEnvsAction({
          ...mocks.mockCliCommandArgs(moveToEnvsName, cliArgs),
          input: {
            elementSelector: ['salto.Account'],
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.AppError)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content).toContain(Prompts.MOVE_FAILED('Oy Vey Zmir'))
      })
    })

    describe('with invalid element selectors', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        result = await moveToEnvsAction({
          ...mocks.mockCliCommandArgs(moveToEnvsName, cliArgs),
          input: {
            elementSelector: ['a.b.c.d'],
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should not call workspace demote', () => {
        expect(workspace.demote).not.toHaveBeenCalled()
      })

      it('should not flush workspace', () => {
        expect(workspace.flush).not.toHaveBeenCalled()
      })

      it('should print failed to console', () => {
        expect(output.stderr.content).toContain('Failed')
      })
    })

    describe('when user answer no', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(() => Promise.resolve(false))
        const cliArgs = mocks.mockCliArgs()
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.getElementIdsBySelectors = jest.fn().mockResolvedValue([selector])
        result = await moveToEnvsAction({
          ...mocks.mockCliCommandArgs(moveToEnvsName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            force: false,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })

      it('should not move', () => {
        expect(workspace.demote).not.toHaveBeenCalled()
      })
    })

    describe('valid move to envs', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      const selector = new ElemID('salto', 'Account')
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.getElementIdsBySelectors = jest.fn().mockResolvedValue([selector])
        result = await moveToEnvsAction({
          ...mocks.mockCliCommandArgs(moveToEnvsName, cliArgs),
          input: {
            elementSelector: [selector.getFullName()],
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call workspace demote', () => {
        expect(workspace.demote).toHaveBeenCalledWith([selector])
      })

      it('should flush workspace', () => {
        expect(workspace.flush).toHaveBeenCalled()
      })

      it('should print deployment to console', () => {
        expect(output.stdout.content).toBe(`The following configuration elements will be moved to envs:
  - salto.Account


Moving the specified elements to envs.
`)
      })
    })
  })

  describe('move-to-common command', () => {
    const moveToCommonName = 'move-to-common'
    describe('when workspace throws an error on move-to-common', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([new ElemID('salto', 'Account')]))
        workspace.flush.mockRejectedValue(new Error('Oy Vey Zmir'))
        result = await moveToCommonAction({
          ...mocks.mockCliCommandArgs(moveToCommonName, cliArgs),
          input: {
            elementSelector: ['salto.Account'],
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.AppError)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content).toContain(Prompts.MOVE_FAILED('Oy Vey Zmir'))
      })
    })

    describe('with invalid element selectors', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        result = await moveToCommonAction({
          ...mocks.mockCliCommandArgs(moveToCommonName, cliArgs),
          input: {
            elementSelector: ['a.b.c.d', 'e.f.g.h'],
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should not call workspace promote', () => {
        expect(workspace.promote).not.toHaveBeenCalled()
      })

      it('should not flush workspace', () => {
        expect(workspace.flush).not.toHaveBeenCalled()
      })

      it('should print failed to console', () => {
        expect(output.stderr.content).toContain('Failed')
      })
    })

    describe('Without env option', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      const selector = new ElemID('salto', 'Account')
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([selector]))
        result = await moveToCommonAction({
          ...mocks.mockCliCommandArgs(moveToCommonName, cliArgs),
          input: {
            elementSelector: ['salto.Account'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })
      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call workspace promote', () => {
        expect(workspace.promote).toHaveBeenCalledWith([selector], {})
      })

      it('should flush workspace', () => {
        expect(workspace.flush).toHaveBeenCalled()
      })

      it('should print deployment to console', () => {
        expect(output.stdout.content).toContain('Moving the specified elements to common')
      })
    })

    describe('With env option', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      const selector = new ElemID('salto', 'Account')
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([selector]))
        result = await moveToCommonAction({
          ...mocks.mockCliCommandArgs(moveToCommonName, cliArgs),
          input: {
            elementSelector: ['salto.Account'],
            env: 'active',
            force: true,
            allowElementDeletions: false,
          },
          workspace,
        })
      })

      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call workspace promote', () => {
        expect(workspace.promote).toHaveBeenCalledWith([selector], {})
      })

      it('should flush workspace', () => {
        expect(workspace.flush).toHaveBeenCalled()
      })

      it('should print deployment to console', () => {
        expect(output.stdout.content).toBe(`The following configuration elements will be moved to common:
  - salto.Account


Moving the specified elements to common.
`)
      })
    })

    describe('allowElementDeletions', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      const elemToAdd = new ElemID('salto', 'elemToAdd')
      const elemToRemoveFromEnv2 = new ElemID('salto', 'elemToRemoveFromEnv2')
      const elemToRemoveFromEnv3 = new ElemID('salto', 'elemToRemoveFromEnv3')
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({
          envs: ['env1', 'env2', 'env3'],
        })
        workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToAdd]))
        workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToRemoveFromEnv2]))
        workspace.getElementIdsBySelectors.mockResolvedValueOnce(awu([elemToRemoveFromEnv3]))
        result = await moveToCommonAction({
          ...mocks.mockCliCommandArgs(moveToCommonName, cliArgs),
          input: {
            elementSelector: [
              elemToAdd.getFullName(),
              elemToRemoveFromEnv2.getFullName(),
              elemToRemoveFromEnv3.getFullName(),
            ],
            env: 'env1',
            force: true,
            allowElementDeletions: true,
          },
          workspace,
        })
      })

      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call workspace promote', () => {
        expect(workspace.promote).toHaveBeenCalledWith([elemToAdd], {
          env2: [elemToRemoveFromEnv2],
          env3: [elemToRemoveFromEnv3],
        })
      })

      it('should flush workspace', () => {
        expect(workspace.flush).toHaveBeenCalled()
      })

      it('should print deployment to console', () => {
        expect(output.stdout.content).toBe(`The following configuration elements will be moved to common:
  - salto.elemToAdd


The following configuration elements will be deleted from env2:
  - salto.elemToRemoveFromEnv2


The following configuration elements will be deleted from env3:
  - salto.elemToRemoveFromEnv3


Moving the specified elements to common.
`)
      })
    })
  })

  describe('list-unresolved command', () => {
    const listUnresolvedName = 'list-unresolved'

    describe('success - all unresolved references are found in complete-from', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let userBooleanInput: jest.SpiedFunction<(typeof callbacks)['getUserBooleanInput']>
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        userBooleanInput = jest.spyOn(callbacks, 'getUserBooleanInput')
        userBooleanInput.mockRestore()
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        // Should ignore unresolved reference errors
        workspace.errors.mockResolvedValue(
          new errors.Errors({
            parse: [],
            merge: [],
            validation: [
              new errors.UnresolvedReferenceValidationError({
                elemID: new ElemID('test', 'src'),
                target: new ElemID('test', 'target'),
              }),
            ],
          }),
        )
        result = await listUnresolvedAction({
          ...mocks.mockCliCommandArgs(listUnresolvedName, cliArgs),
          input: {
            completeFrom: 'inactive',
            env: 'active',
            force: false,
          },
          workspace,
        })
      })

      afterAll(() => {
        userBooleanInput.mockRestore()
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })

      it('should ignore unresolved references when loading the workspace', () => {
        expect(userBooleanInput).not.toHaveBeenCalled()
      })

      it('should call listUnresolvedReferences', () => {
        expect(workspace.listUnresolvedReferences).toHaveBeenCalledWith('inactive')
      })

      it('should print found to console', () => {
        expect(output.stdout.content).toContain('The following unresolved references can be copied from inactive:')
        expect(output.stdout.content).toMatch(/salesforce.aaa(\s*)salesforce.bbb.instance.ccc/)
        expect(output.stdout.content).not.toContain('The following unresolved references could not be found:')
      })
    })

    describe('success - no unresolved references', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementationOnce(() =>
          Promise.resolve({
            found: [],
            missing: [],
          }),
        )

        result = await listUnresolvedAction({
          ...mocks.mockCliCommandArgs(listUnresolvedName, cliArgs),
          input: {},
          workspace,
        })
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call listUnresolvedReferences', () => {
        expect(workspace.listUnresolvedReferences).toHaveBeenCalledWith(undefined)
      })

      it('should print list to console', () => {
        expect(output.stdout.content).toContain('All references in active were resolved successfully!')
      })
    })

    describe('success - some references do not exist', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementationOnce(() =>
          Promise.resolve({
            found: [new ElemID('salesforce', 'aaa'), new ElemID('salesforce', 'bbb', 'instance', 'ccc')],
            missing: [new ElemID('salesforce', 'fail')],
          }),
        )
        result = await listUnresolvedAction({
          ...mocks.mockCliCommandArgs(listUnresolvedName, cliArgs),
          input: {
            completeFrom: 'inactive',
          },
          workspace,
        })
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call listUnresolvedReferences', () => {
        expect(workspace.listUnresolvedReferences).toHaveBeenCalledWith('inactive')
      })

      it('should print list to console', () => {
        expect(output.stdout.content).toMatch(
          /The following unresolved references can be copied from inactive:(\s*)salesforce.aaa(\s*)salesforce.bbb.instance.ccc/,
        )
        expect(output.stdout.content).toMatch(
          /The following unresolved references could not be found:(\s*)salesforce.fail/,
        )
      })
    })

    describe('failure - unexpected error', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementationOnce(() => {
          throw new Error('oh no')
        })

        result = await listUnresolvedAction({
          ...mocks.mockCliCommandArgs(listUnresolvedName, cliArgs),
          input: {
            completeFrom: 'inactive',
          },
          workspace,
        })
      })

      it('should return failure', () => {
        expect(result).toBe(CliExitCode.AppError)
      })
      it('should call listUnresolvedReferences', () => {
        expect(workspace.listUnresolvedReferences).toHaveBeenCalledWith('inactive')
      })

      it('should print the error', () => {
        expect(output.stderr.content).toContain('Failed to list unresolved references: oh no')
      })
    })

    describe('failure - invalid complete-from env', () => {
      let result: CliExitCode
      beforeAll(async () => {
        result = await listUnresolvedAction({
          ...mocks.mockCliCommandArgs(listUnresolvedName),
          input: {
            completeFrom: 'invalid',
          },
          workspace: mocks.mockWorkspace({}),
        })
      })

      it('should return failure', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
    })
  })
  describe('open command', () => {
    const commandName = 'open'
    const serviceUrlAccount = 'http://acme.com'
    let workspace: mocks.MockWorkspace
    beforeEach(() => {
      workspace = mocks.mockWorkspace({})
    })

    const getMockElement = (url?: string): ObjectType =>
      new ObjectType({
        elemID: new ElemID('salesforce', 'Lead'),
        annotations: {
          ...(url === undefined ? {} : { [CORE_ANNOTATIONS.SERVICE_URL]: url }),
        },
      })

    describe('with valid elem ID that has a URL', () => {
      let result: CliExitCode
      beforeEach(async () => {
        workspace.getValue.mockResolvedValue(getMockElement(serviceUrlAccount))
        result = await openAction({
          ...mocks.mockCliCommandArgs(commandName),
          input: {
            elementId: 'salesforce.Lead',
            env: mocks.withEnvironmentParam,
          },
          workspace,
        })
      })
      it('should set the requested environment', () => {
        expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
      })
      it('should call open with the url', () => {
        expect(open).toHaveBeenCalledWith(serviceUrlAccount)
      })
      it('should return success exit code', () => {
        expect(result).toEqual(CliExitCode.Success)
      })
    })

    describe('with valid ID that does not have a URL', () => {
      let output: mocks.MockCliOutput
      let result: CliExitCode
      beforeEach(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace.getValue.mockResolvedValue(getMockElement(undefined))
        result = await openAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            elementId: 'salesforce.Date',
          },
          workspace,
        })
      })
      it('should print element does not have a url', () => {
        expect(output.stderr.content).toEqual('Go to service is not supported for element salesforce.Date\n')
      })
      it('should return error exit code', () => {
        expect(result).toEqual(CliExitCode.AppError)
      })
    })

    describe('with element ID that does not exist', () => {
      let output: mocks.MockCliOutput
      let result: CliExitCode
      beforeEach(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace.getValue.mockResolvedValue(undefined)
        result = await openAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            elementId: 'salesforce.Nonexisting',
          },
          workspace,
        })
      })
      it('should print element does not exist', () => {
        expect(output.stderr.content).toEqual('Did not find any matches for element salesforce.Nonexisting\n')
      })
      it('should return error', () => {
        expect(result).toEqual(CliExitCode.UserInputError)
      })
    })

    describe('with invalid element ID', () => {
      let output: mocks.MockCliOutput
      let result: CliExitCode
      beforeEach(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace.getValue.mockResolvedValue(undefined)
        result = await openAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            elementId: 'foo.bla.bar.buzz',
          },
          workspace,
        })
      })
      it('should print the id is invalid', () => {
        expect(output.stderr.content).toEqual('Cannot create ID foo.bla.bar.buzz - Invalid ID type bar\n')
      })
      it('should return error exit code', () => {
        expect(result).toEqual(CliExitCode.UserInputError)
      })
    })

    describe('with valid ID that is not an element', () => {
      let output: mocks.MockCliOutput
      let result: CliExitCode
      beforeEach(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace.getValue.mockResolvedValue('LabelValue')
        result = await openAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            elementId: 'salesforce.Lead.field.Account.label',
          },
          workspace,
        })
      })
      it('should print element does not have a url', () => {
        expect(output.stderr.content).toEqual(
          'Go to service is not supported for element salesforce.Lead.field.Account.label\n',
        )
      })
      it('should return error exit code', () => {
        expect(result).toEqual(CliExitCode.AppError)
      })
    })
  })

  describe('list command', () => {
    const moveToCommonName = 'list'

    describe('when workspace throws an error on list', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const workspace = mocks.mockWorkspace({})
        workspace.listUnresolvedReferences.mockImplementation(mockedList)
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([new ElemID('salto', 'Account')]))
        workspace.errors.mockRejectedValue(new Error('Oy Vey Zmir'))
        result = await listAction({
          ...mocks.mockCliCommandArgs(moveToCommonName, cliArgs),
          input: {
            elementSelector: ['salto.Account'],
            mode: 'env',
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.AppError)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content).toContain(Prompts.LIST_FAILED('Oy Vey Zmir'))
      })
    })

    describe('with invalid element selectors', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        result = await listAction({
          ...mocks.mockCliCommandArgs(moveToCommonName, cliArgs),
          input: {
            elementSelector: ['a.b.c.d', 'e.f.g.h'],
            mode: 'all',
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should not call workspace getElementsBySelectors', () => {
        expect(workspace.getElementIdsBySelectors).not.toHaveBeenCalled()
      })

      it('should print failed to console', () => {
        expect(output.stderr.content).toContain('Failed')
      })
    })

    describe('successful list cmd', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      const stringSelector = 'salto.Account'
      const elemID = new ElemID('salto', 'Account')
      let output: mocks.MockCliOutput
      const mode = 'env'
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        workspace.getElementIdsBySelectors.mockResolvedValue(awu([elemID]))
        result = await listAction({
          ...mocks.mockCliCommandArgs(moveToCommonName, cliArgs),
          input: {
            elementSelector: [stringSelector],
            mode,
          },
          workspace,
        })
      })

      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call workspace getElementIdsBySelectors', () => {
        const elemSelector = createElementSelector(stringSelector)
        expect(workspace.getElementIdsBySelectors).toHaveBeenCalledWith([elemSelector], { source: mode }, true)
      })

      it('should print to stdout', () => {
        expect(output.stdout.content).toContain('The following configuration elements were found')
      })
    })
  })

  describe('rename command', () => {
    const commandName = 'rename'
    describe('with errored workspace', () => {
      let result: CliExitCode
      beforeAll(async () => {
        const workspace = mocks.mockWorkspace({})
        workspace.errors.mockResolvedValue(mocks.mockErrors([{ severity: 'Error', message: 'some error' }]))
        const cliArgs = mocks.mockCliArgs()
        result = await renameAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            sourceElementId: 'salto.object',
            targetElementId: 'salto.object.notId',
          },
          workspace,
        })
      })

      it('should fail', async () => {
        expect(result).toBe(CliExitCode.AppError)
      })
    })
    describe('with invalid element ids', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        result = await renameAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            sourceElementId: 'salto.object',
            targetElementId: 'salto.object.notId',
          },
          workspace,
        })
      })
      it('should fail', () => {
        expect(result).toEqual(CliExitCode.UserInputError)
        expect(output.stderr.content).toEqual('Cannot create ID salto.object.notId - Invalid ID type notId\n')
      })
    })
    describe('when RenameElementIdError is throwen', () => {
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let output: mocks.MockCliOutput
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})
        result = await renameAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            sourceElementId: 'salto.object.field.name',
            targetElementId: 'salto.object.field.rename',
          },
          workspace,
        })
      })
      it('should fail', () => {
        expect(result).toEqual(CliExitCode.UserInputError)
        expect(output.stderr.content).toEqual('Source element should be top level\n')
      })
    })
    describe('when other error throwen', () => {
      let workspace: mocks.MockWorkspace
      let cliArgs: mocks.MockCliArgs
      beforeAll(async () => {
        cliArgs = mocks.mockCliArgs()
        workspace = mocks.mockWorkspace({})
        workspace.getValue.mockRejectedValue(new Error('some error'))
      })
      it('should fail', async () =>
        expect(
          renameAction({
            ...mocks.mockCliCommandArgs(commandName, cliArgs),
            input: {
              sourceElementId: 'salto.object.instance.name',
              targetElementId: 'salto.object.instance.rename',
            },
            workspace,
          }),
        ).rejects.toThrow('some error'))
    })
    describe('valid rename', () => {
      let output: mocks.MockCliOutput
      let result: CliExitCode
      let workspace: mocks.MockWorkspace
      let allElements: Element[]
      let sourceElement: InstanceElement

      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        workspace = mocks.mockWorkspace({})

        allElements = await awu(await (await workspace.elements()).getAll()).toArray()
        sourceElement = allElements.find(isInstanceElement) as InstanceElement
        const sourceElemId = sourceElement.elemID
        const targetElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'renamed')

        workspace.getValue.mockResolvedValueOnce(sourceElement).mockResolvedValueOnce(undefined)
        result = await renameAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            sourceElementId: sourceElemId.getFullName(),
            targetElementId: targetElemId.getFullName(),
          },
          workspace,
        })
      })
      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should return no errors', () => {
        expect(output.stderr.content).toEqual('')
      })
    })
  })

  describe('print command', () => {
    const commandName = 'print'
    describe('with invalid selectors', () => {
      let result: CliExitCode
      beforeAll(async () => {
        const cliArgs = mocks.mockCliArgs()
        const workspace = mocks.mockWorkspace({})
        result = await printElementAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            selectors: ['a.b.c.d'],
            source: 'nacl',
            onlyValue: false,
          },
          workspace,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
    })
    describe('with source nacl', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeEach(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const workspace = mocks.mockWorkspace({})
        const elements = await workspace.elements()
        await elements.set(new ObjectType({ elemID: new ElemID('test', 'type') }))
        result = await printElementAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            selectors: ['test.type'],
            source: 'nacl',
            onlyValue: false,
          },
          workspace,
        })
      })
      it('should return success exit code', () => {
        expect(result).toEqual(CliExitCode.Success)
      })
      it('should print the element with the ID as a prefix', () => {
        expect(output.stdout.content).toMatch(/^test.type:.*type test.type {.*/)
      })
    })
    describe('with source state', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeEach(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const workspace = mocks.mockWorkspace({})
        await workspace.state().set(new ObjectType({ elemID: new ElemID('test', 'type') }))
        result = await printElementAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            selectors: ['test.*'],
            source: 'state',
            onlyValue: true,
          },
          workspace,
        })
      })
      it('should return success exit code', () => {
        expect(result).toEqual(CliExitCode.Success)
      })
      it('should print the element without the ID as a prefix', () => {
        expect(output.stdout.content).toMatch(/^type test.type {.*/)
      })
    })
    describe('with nested selector matching multiple entries', () => {
      let result: CliExitCode
      let output: mocks.MockCliOutput
      beforeEach(async () => {
        const cliArgs = mocks.mockCliArgs()
        output = cliArgs.output
        const workspace = mocks.mockWorkspace({})
        result = await printElementAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            selectors: ['salto.*.field.*.label'],
            source: 'state',
            onlyValue: false,
          },
          workspace,
        })
      })
      it('should return success exit code', () => {
        expect(result).toEqual(CliExitCode.Success)
      })
      it('should print the element without the ID as a prefix', () => {
        const fieldsWithLabel = mocks
          .elements()
          .filter(isObjectType)
          .flatMap(objType => Object.values(objType.fields))
          .filter(field => field.annotations.label !== undefined)
        fieldsWithLabel.forEach(field => {
          expect(output.stdout.content).toContain(field.elemID.createNestedID('label').getFullName())
          expect(output.stdout.content).toContain(field.annotations.label)
        })
      })
    })
  })

  describe('fix command', () => {
    const commandName = 'fix'
    let cliArgs: mocks.MockCliArgs
    let workspace: MockWorkspace
    let fixElementsMock: jest.MockedFunction<typeof fixElements>
    let type: ObjectType

    beforeEach(() => {
      type = new ObjectType({
        elemID: new ElemID('salto', 'type'),
      })
      cliArgs = mocks.mockCliArgs()
      workspace = mocks.mockWorkspace({ getElements: () => [type] })
      workspace.getValue.mockResolvedValue(type)
      fixElementsMock = fixElements as jest.Mock
      fixElementsMock.mockClear()
      fixElementsMock.mockResolvedValue({
        changes: [],
        errors: [],
      })
    })

    it('should do nothing where there are no fixes', async () => {
      const result = await fixElementsAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: { selectors: [type.elemID.getFullName()] },
        workspace,
      })

      expect(result).toBe(CliExitCode.Success)
      expect(workspace.updateNaclFiles).not.toHaveBeenCalled()
      expect(workspace.flush).not.toHaveBeenCalled()
      expect(cliArgs.output.stdout.content).toContain('Nothing to do.')
    })

    it('should return an error for invalid selector', async () => {
      const result = await fixElementsAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: { selectors: ['a.b.c.d'] },
        workspace,
      })

      expect(result).toBe(CliExitCode.UserInputError)
    })

    it('should return an error for non top level selector', async () => {
      fixElementsMock.mockRejectedValue(new SelectorsError('message', []))
      const result = await fixElementsAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: { selectors: ['salto.type.attr.d'] },
        workspace,
      })

      expect(result).toBe(CliExitCode.UserInputError)
    })

    it('should apply the fixes to the workspace', async () => {
      const typeWithFix = type.clone()
      typeWithFix.annotations.fix1 = 'fix1'

      fixElementsMock.mockResolvedValue({
        changes: [
          {
            action: 'add',
            data: { after: 'fix1' },
            id: typeWithFix.elemID.createNestedID('attr', 'fix1'),
            elemIDs: {
              before: typeWithFix.elemID.createNestedID('attr', 'fix1'),
              after: typeWithFix.elemID.createNestedID('attr', 'fix1'),
            },
          },
        ],
        errors: [
          {
            elemID: typeWithFix.elemID,
            severity: 'Info',
            message: 'Fix1',
            detailedMessage: 'Detailed fix1',
          },
        ],
      })

      const result = await fixElementsAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: { selectors: [type.elemID.getFullName()] },
        workspace,
      })

      expect(result).toBe(CliExitCode.Success)
      expect(cliArgs.output.stdout.content).toContain('Fix1')
      expect(cliArgs.output.stdout.content).toContain('Detailed fix1')

      expect(workspace.updateNaclFiles).toHaveBeenCalledWith([
        {
          id: type.elemID.createNestedID('attr', 'fix1'),
          action: 'add',
          data: { after: 'fix1' },
          elemIDs: {
            before: type.elemID.createNestedID('attr', 'fix1'),
            after: type.elemID.createNestedID('attr', 'fix1'),
          },
        },
      ])
      expect(workspace.flush).toHaveBeenCalled()
    })
  })
})
