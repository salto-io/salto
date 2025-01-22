/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { diff } from '@salto-io/core'
import { MockWorkspace, mockWorkspace } from '@salto-io/e2e-test-utils'

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
      const workspace = mockWorkspace({})
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
      const workspace = mockWorkspace({})
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
    let workspace: MockWorkspace
    beforeAll(async () => {
      workspace = mockWorkspace({})
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
    let workspace: MockWorkspace
    beforeAll(async () => {
      workspace = mockWorkspace({})
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
    let workspace: MockWorkspace
    beforeAll(async () => {
      workspace = mockWorkspace({})
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
    let workspace: MockWorkspace
    const regex = 'account.*'
    beforeAll(async () => {
      workspace = mockWorkspace({})
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
    let workspace: MockWorkspace
    const regex = '['
    beforeAll(async () => {
      workspace = mockWorkspace({})
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
