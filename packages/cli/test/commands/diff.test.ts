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
import { diff } from '@salto-io/core'
import { CliExitCode } from '../../src/types'
import { diffAction } from '../../src/commands/env'
import { expectElementSelector } from '../utils'
import * as mocks from '../mocks'

const commandName = 'diff'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
  diff: jest.fn().mockImplementation(() => Promise.resolve([])),
}))
describe('diff command', () => {
  describe('with invalid source environment', () => {
    it('should throw Error', async () => {
      const workspace = mocks.mockWorkspace({})
      const result = await diffAction({
        ...mocks.mockCliCommandArgs(commandName),
        input: {
          fromEnv: 'NotExist',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: false,
        },
        workspace,
      })
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })

  describe('with invalid destination environment', () => {
    it('should throw Error', async () => {
      const workspace = mocks.mockWorkspace({})
      const result = await diffAction({
        ...mocks.mockCliCommandArgs(commandName),
        input: {
          fromEnv: 'active',
          toEnv: 'NotExist',
          detailedPlan: true,
          hidden: false,
          state: false,
        },
        workspace,
      })
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })

  describe('with valid workspace', () => {
    let result: CliExitCode
    let workspace: mocks.MockWorkspace
    beforeAll(async () => {
      workspace = mocks.mockWorkspace({})
      result = await diffAction({
        ...mocks.mockCliCommandArgs(commandName),
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: false,
        },
        workspace,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'active', 'inactive', false, false, undefined, [])
    })
  })

  describe('with show hidden types flag', () => {
    let result: CliExitCode
    let workspace: mocks.MockWorkspace
    beforeAll(async () => {
      workspace = mocks.mockWorkspace({})
      result = await diffAction({
        ...mocks.mockCliCommandArgs(commandName),
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: true,
          state: false,
        },
        workspace,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'active', 'inactive', true, false, undefined, [])
    })
  })

  describe('with state only flag', () => {
    let result: CliExitCode
    let workspace: mocks.MockWorkspace
    beforeAll(async () => {
      workspace = mocks.mockWorkspace({})
      result = await diffAction({
        ...mocks.mockCliCommandArgs(commandName),
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: true,
        },
        workspace,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'active', 'inactive', false, true, undefined, [])
    })
  })

  describe('with id filters', () => {
    let result: CliExitCode
    let workspace: mocks.MockWorkspace
    const regex = 'account.*'
    beforeAll(async () => {
      workspace = mocks.mockWorkspace({})
      result = await diffAction({
        ...mocks.mockCliCommandArgs(commandName),
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: true,
          elementSelector: [regex],
        },
        workspace,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(
        workspace,
        'active',
        'inactive',
        false,
        true,
        undefined,
        expectElementSelector(regex),
      )
    })
  })

  describe('with invalid id filters', () => {
    let result: CliExitCode
    let workspace: mocks.MockWorkspace
    const regex = '['
    beforeAll(async () => {
      workspace = mocks.mockWorkspace({})
      result = await diffAction({
        ...mocks.mockCliCommandArgs(commandName),
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: true,
          elementSelector: [regex],
        },
        workspace,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })
})
