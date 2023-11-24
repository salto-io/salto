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
import { EOL } from 'os'
import { cleanWorkspace } from '@salto-io/core'
import { WorkspaceComponents } from '@salto-io/workspace'
import { getUserBooleanInput } from '../callbacks'
import { header, formatCleanWorkspace, formatCancelCommand, formatStepStart, formatStepFailed, formatStepCompleted } from '../formatter'
import { outputLine, errorOutputLine } from '../outputer'
import Prompts from '../prompts'
import { CliExitCode } from '../types'
import { createCommandGroupDef, createWorkspaceCommand, WorkspaceCommandAction } from '../command_builder'

type CleanArgs = {
  force: boolean
} & WorkspaceComponents

export const cleanAction: WorkspaceCommandAction<CleanArgs> = async ({
  input: { force, ...cleanArgs },
  output,
  workspace,
}): Promise<CliExitCode> => {
  const shouldCleanAnything = Object.values(cleanArgs).some(shouldClean => shouldClean)
  if (!shouldCleanAnything) {
    outputLine(header(Prompts.EMPTY_PLAN), output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }
  if (cleanArgs.staticResources && !(cleanArgs.state && cleanArgs.cache && cleanArgs.nacl)) {
    errorOutputLine('Cannot clear static resources without clearing the state, cache and nacls', output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }

  outputLine(header(
    formatCleanWorkspace(cleanArgs)
  ), output)
  if (!(force || await getUserBooleanInput(Prompts.SHOULD_EXECUTE_PLAN))) {
    outputLine(formatCancelCommand, output)
    return CliExitCode.Success
  }

  outputLine(formatStepStart(Prompts.CLEAN_STARTED), output)

  try {
    await cleanWorkspace(workspace, cleanArgs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e : any) {
    errorOutputLine(formatStepFailed(Prompts.CLEAN_FAILED(e.toString())), output)
    return CliExitCode.AppError
  }

  outputLine(formatStepCompleted(Prompts.CLEAN_FINISHED), output)
  outputLine(EOL, output)
  return CliExitCode.Success
}

const wsCleanDef = createWorkspaceCommand({
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
        description: 'Clear the account login credentials',
        type: 'boolean',
        default: false,
      },
      {
        name: 'accountConfig',
        alias: 'g',
        description: 'Restore account configuration to default',
        type: 'boolean',
        default: false,
      },
    ],
  },
  action: cleanAction,
})

type CacheUpdateArgs = {}
export const cacheUpdateAction: WorkspaceCommandAction<CacheUpdateArgs> = async ({
  workspace,
  output,
}) => {
  outputLine('Updating workspace cache', output)
  await workspace.flush()
  return CliExitCode.Success
}

const cacheUpdateDef = createWorkspaceCommand({
  properties: {
    name: 'update',
    description: 'Update the workspace cache',
  },
  action: cacheUpdateAction,
})

const cacheGroupDef = createCommandGroupDef({
  properties: {
    name: 'cache',
    description: 'Commands for workspace cache administration',
  },
  subCommands: [
    cacheUpdateDef,
  ],
})

// Group definition
const wsGroupDef = createCommandGroupDef({
  properties: {
    name: 'workspace',
    description: 'Workspace administration commands',
  },
  subCommands: [
    wsCleanDef,
    cacheGroupDef,
  ],
})

export default wsGroupDef
