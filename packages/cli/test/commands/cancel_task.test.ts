/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as core from '@salto-io/core'
import { mockWorkspace } from '@salto-io/e2e-test-utils'
import { action, CancelTaskInput } from '../../src/commands/cancel_task'
import { mockCliArgs, mockCliCommandArgs } from '../mocks'
import { CliExitCode } from '../../src/types'
import * as outputer from '../../src/outputer'
import { WorkspaceCommandArgs } from '../../src/command_builder'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  cancelServiceAsyncTask: jest.fn(),
}))
const mockedCore = jest.mocked(core)

jest.mock('../../src/outputer')
const mockedOutputer = jest.mocked(outputer)

describe('cancel-task command', () => {
  let commandArgs: WorkspaceCommandArgs<CancelTaskInput>
  beforeEach(() => {
    commandArgs = {
      ...mockCliCommandArgs('cancel-task', mockCliArgs()),
      workspace: mockWorkspace({}),
      input: { taskId: 'taskId', account: 'account' },
    }
  })
  describe('when cancelServiceAsyncTask returns errors', () => {
    beforeEach(() => {
      mockedCore.cancelServiceAsyncTask.mockResolvedValue({
        errors: [{ severity: 'Error', message: 'error', detailedMessage: 'error' }],
      })
    })
    it('should output error', async () => {
      const result = await action(commandArgs)
      expect(mockedOutputer.errorOutputLine).toHaveBeenCalled()
      expect(result).toBe(CliExitCode.AppError)
    })
  })
  describe('when cancelServiceAsyncTask throws error', () => {
    beforeEach(() => {
      mockedCore.cancelServiceAsyncTask.mockRejectedValue(new Error('Not Supported'))
    })
    it('should output error', async () => {
      const result = await action(commandArgs)
      expect(mockedOutputer.errorOutputLine).toHaveBeenCalled()
      expect(result).toBe(CliExitCode.AppError)
    })
  })
  describe('when cancelServiceAsyncTask returns no errors', () => {
    beforeEach(() => {
      mockedCore.cancelServiceAsyncTask.mockResolvedValue({ errors: [] })
    })
    it('should output success', async () => {
      const result = await action(commandArgs)
      expect(mockedOutputer.outputLine).toHaveBeenCalled()
      expect(result).toBe(CliExitCode.Success)
    })
  })

  describe('when cancelServiceAsyncTask returns warnings', () => {
    beforeEach(() => {
      mockedCore.cancelServiceAsyncTask.mockResolvedValue({
        errors: [{ severity: 'Warning', message: 'warning', detailedMessage: 'warning' }],
      })
    })
    it('should output success', async () => {
      const result = await action(commandArgs)
      expect(mockedOutputer.outputLine).toHaveBeenCalled()
      expect(result).toBe(CliExitCode.Success)
    })
  })
})
