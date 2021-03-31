/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { EOL } from 'os'
import { cleanWorkspace } from '@salto-io/core'
import { WorkspaceComponents } from '@salto-io/workspace'
import { errorOutputLine, outputLine } from '../outputer'
import { getUserBooleanInput } from '../callbacks'
import { formatCleanWorkspace, formatCancelCommand, header, formatStepStart, formatStepFailed, formatStepCompleted } from '../formatter'
import Prompts from '../prompts'
import { CliExitCode } from '../types'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { validateWorkspace } from '../workspace/workspace'

type CleanArgs = {
  force: boolean
  regenerateCache: boolean
} & WorkspaceComponents

export const action: WorkspaceCommandAction<CleanArgs> = async ({
  input: { force, ...allCleanArgs },
  output,
  workspace,
}): Promise<CliExitCode> => {
  const shouldCleanAnything = Object.values(allCleanArgs).some(shouldClean => shouldClean)
  if (!shouldCleanAnything) {
    outputLine(header(Prompts.EMPTY_PLAN), output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }
  if (allCleanArgs.regenerateCache && allCleanArgs.cache) {
    errorOutputLine('Cannot re-generate and clear the cache in the same operation', output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }
  const cleanArgs = {
    ..._.omit(allCleanArgs, 'regenerateCache', 'cache'),
    // should still clear the cache before re-generating it
    cache: allCleanArgs.cache || allCleanArgs.regenerateCache,
  }
  if (cleanArgs.staticResources && !(cleanArgs.state && cleanArgs.cache && cleanArgs.nacl)) {
    errorOutputLine('Cannot clear static resources without clearing the state, cache and nacls', output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }

  outputLine(header(
    formatCleanWorkspace(allCleanArgs)
  ), output)
  if (!(force || await getUserBooleanInput(Prompts.SHOULD_EXECUTE_PLAN))) {
    outputLine(formatCancelCommand, output)
    return CliExitCode.Success
  }

  outputLine(formatStepStart(Prompts.CLEAN_STARTED), output)

  try {
    await cleanWorkspace(workspace, cleanArgs)
    if (allCleanArgs.regenerateCache) {
      await validateWorkspace(workspace)
      await workspace.flush()
    }
  } catch (e) {
    errorOutputLine(formatStepFailed(Prompts.CLEAN_FAILED(e.toString())), output)
    return CliExitCode.AppError
  }

  outputLine(formatStepCompleted(Prompts.CLEAN_FINISHED), output)
  outputLine(EOL, output)
  return CliExitCode.Success
}

const cleanDef = createWorkspaceCommand({
  properties: {
    name: 'clean',
    description: 'Maintenance command for cleaning workspace data. This operation cannot be undone, it\'s highly recommended to backup the workspace data before executing it.',
    keyedOptions: [
      {
        name: 'force',
        alias: 'f',
        description: 'Do not ask for approval before applying the changes',
        type: 'boolean',
      },
      {
        name: 'nacl',
        alias: 'n',
        description: 'Do not remove the nacl files',
        type: 'boolean',
        default: true,
      },
      {
        name: 'state',
        alias: 's',
        description: 'Do not clear the state',
        type: 'boolean',
        default: true,
      },
      {
        name: 'cache',
        alias: 'c',
        description: 'Do not clear the cache',
        type: 'boolean',
        default: true,
      },
      {
        name: 'staticResources',
        alias: 'r',
        description: 'Do not remove remove the static resources',
        type: 'boolean',
        default: true,
      },
      {
        name: 'credentials',
        alias: 'l',
        description: 'Clear the service login credentials',
        type: 'boolean',
        default: false,
      },
      {
        name: 'serviceConfig',
        alias: 'g',
        description: 'Restore service configuration to default',
        type: 'boolean',
        default: false,
      },
      {
        name: 'regenerateCache',
        alias: 'x',
        description: 'Regenerate the cache',
        type: 'boolean',
        default: false,
      },
    ],
  },
  action,
})

export default cleanDef
