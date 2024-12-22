/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { cancelServiceAsyncTask } from '@salto-io/core'
import { inspectValue } from '@salto-io/adapter-utils'
import { createWorkspaceCommand } from '../command_builder'
import { errorOutputLine, outputLine } from '../outputer'
import { CliExitCode } from '../types'


const cancelAsyncTaskDef = createWorkspaceCommand<{taskId: string; account: string}>({
  properties: {
    name: 'cancelAsyncTask',
    description: 'Cancel an async task',
    keyedOptions: [
      {
        name: 'account',
        description: 'The account to cancel the async task in',
        alias: 'a',
        required: true,
        type: 'string',
      }
    ],
    positionalOptions: [
      {
        name: 'taskId',
        description: 'The ID of the task to cancel',
        required: true,
        type: 'string',
      },
    ],
  },
  action: async ({ input, workspace, output }) => {
    const { taskId, account } = input
    const result =  await cancelServiceAsyncTask({workspace, account, input: {taskId}})
    const errors = result.errors.filter(e => e.severity === 'Error')
    if (errors.length > 0) {
      errorOutputLine(`Failed to cancel async task ${taskId} with Errors: ${inspectValue(errors)}`, output)
      return CliExitCode.AppError
    }
    outputLine(`Async task ${taskId} was cancelled successfully`, output)
    return CliExitCode.Success
  }
})

export default cancelAsyncTaskDef