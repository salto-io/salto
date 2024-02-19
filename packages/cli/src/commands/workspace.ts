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
import { EOL } from 'os'
import { cleanWorkspace } from '@salto-io/core'
import { ProviderOptionsS3, StateConfig, WorkspaceComponents } from '@salto-io/workspace'
import { getUserBooleanInput } from '../callbacks'
import {
  header,
  formatCleanWorkspace,
  formatCancelCommand,
  formatStepStart,
  formatStepFailed,
  formatStepCompleted,
} from '../formatter'
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

  outputLine(header(formatCleanWorkspace(cleanArgs)), output)
  if (!(force || (await getUserBooleanInput(Prompts.SHOULD_EXECUTE_PLAN)))) {
    outputLine(formatCancelCommand, output)
    return CliExitCode.Success
  }

  outputLine(formatStepStart(Prompts.CLEAN_STARTED), output)

  try {
    await cleanWorkspace(workspace, cleanArgs)
  } catch (e) {
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
    description:
      "Maintenance command for cleaning workspace data. This operation cannot be undone, it's highly recommended to backup the workspace data before executing it.",
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
export const cacheUpdateAction: WorkspaceCommandAction<CacheUpdateArgs> = async ({ workspace, output }) => {
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
  subCommands: [cacheUpdateDef],
})

type SetStateProviderArgs = {
  provider?: StateConfig['provider']
} & Partial<ProviderOptionsS3>

export const setStateProviderAction: WorkspaceCommandAction<SetStateProviderArgs> = async ({
  workspace,
  input,
  output,
}) => {
  const { provider, bucket, prefix } = input
  outputLine(`Setting state provider ${provider} for workspace`, output)
  const stateConfig: StateConfig = { provider: provider ?? 'file' }

  if (provider === 's3') {
    if (bucket === undefined) {
      errorOutputLine('Must set bucket name with provider of type s3', output)
      return CliExitCode.UserInputError
    }
    stateConfig.options = { s3: { bucket, prefix } }
  }
  if (provider !== 's3' && bucket !== undefined) {
    errorOutputLine('bucket argument is only valid with provider type s3', output)
    return CliExitCode.UserInputError
  }

  await workspace.updateStateProvider(provider === undefined ? undefined : stateConfig)
  return CliExitCode.Success
}

const setStateProviderDef = createWorkspaceCommand({
  action: setStateProviderAction,
  properties: {
    name: 'set-state-provider',
    description: 'Set the location where state data will be stored',
    keyedOptions: [
      {
        name: 'provider',
        alias: 'p',
        type: 'string',
        choices: ['file', 's3'],
        required: false,
      },
      {
        name: 'bucket',
        type: 'string',
        description: 'When provider is S3, the bucket name were state data can be stored',
      },
      {
        name: 'prefix',
        type: 'string',
        description: 'A prefix inside the bucket where files will be stored',
      },
    ],
  },
})

// Group definition
const wsGroupDef = createCommandGroupDef({
  properties: {
    name: 'workspace',
    description: 'Workspace administration commands',
  },
  subCommands: [wsCleanDef, cacheGroupDef, setStateProviderDef],
})

export default wsGroupDef
