/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { loadLocalWorkspace, envFolderExists } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { CliCommand, CliExitCode, ParsedCliInput, CliOutput } from '../types'

import { createCommandBuilder } from '../command_builder'
import {
  formatEnvListItem, formatCurrentEnv, formatCreateEnv, formatSetEnv, formatDeleteEnv,
  formatRenameEnv, formatApproveIsolateCurrentEnvPrompt, formatDoneIsolatingCurrentEnv,
} from '../formatter'
import { cliApproveIsolateBeforeMultiEnv } from '../callbacks'
import { outputLine, errorOutputLine } from '../outputer'

const NEW_ENV_NAME = 'new-name'

const setEnvironment = async (
  envName: string,
  output: CliOutput,
  workspace: Workspace,
): Promise<CliExitCode> => {
  await workspace.setCurrentEnv(envName)
  outputLine(formatSetEnv(envName), output)
  return CliExitCode.Success
}

const shouldRecommendToIsolateCurrentEnv = async (
  workspace: Workspace,
  workspaceDir: string,
): Promise<boolean> => {
  const envNames = workspace.envs()
  return (
    envNames.length === 1
    && !await workspace.isEmpty(true)
    && !await envFolderExists(workspaceDir, envNames[0])
  )
}

const isolateExistingEnvironments = async (workspace: Workspace): Promise<void> => {
  await workspace.demoteAll()
  await workspace.flush()
}

const maybeIsolateExistingEnv = async (
  output: CliOutput,
  workspace: Workspace,
  workspaceDir: string,
  force?: boolean,
  acceptSuggestions?: boolean,
): Promise<void> => {
  if (
    (!force || acceptSuggestions)
    && await shouldRecommendToIsolateCurrentEnv(workspace, workspaceDir)
  ) {
    const existingEnv = workspace.envs()[0]
    outputLine(formatApproveIsolateCurrentEnvPrompt(existingEnv), output)
    if (acceptSuggestions || await cliApproveIsolateBeforeMultiEnv(existingEnv)) {
      await isolateExistingEnvironments(workspace)
      outputLine(formatDoneIsolatingCurrentEnv(existingEnv), output)
    }
  }
}

const createEnvironment = async (
  envName: string,
  output: CliOutput,
  workspace: Workspace,
  workspaceDir: string,
  force?: boolean,
  acceptSuggestions?: boolean,
): Promise<CliExitCode> => {
  await maybeIsolateExistingEnv(output, workspace, workspaceDir, force, acceptSuggestions)

  await workspace.addEnvironment(envName)
  await setEnvironment(envName, output, workspace)
  outputLine(formatCreateEnv(envName), output)
  return CliExitCode.Success
}

const deleteEnvironment = async (
  envName: string,
  output: CliOutput,
  workspace: Workspace,
): Promise<CliExitCode> => {
  await workspace.deleteEnvironment(envName)
  outputLine(formatDeleteEnv(envName), output)
  return CliExitCode.Success
}

const renameEnvironment = async (
  envName: string,
  newEnvName: string,
  output: CliOutput,
  workspace: Workspace,
): Promise<CliExitCode> => {
  await workspace.renameEnvironment(envName, newEnvName)
  outputLine(formatRenameEnv(envName, newEnvName), output)
  return CliExitCode.Success
}

const getCurrentEnv = (
  output: CliOutput,
  workspace: Workspace,
): CliExitCode => {
  outputLine(formatCurrentEnv(workspace.currentEnv()), output)
  return CliExitCode.Success
}

const listEnvs = (
  output: CliOutput,
  workspace: Workspace,
): CliExitCode => {
  const list = formatEnvListItem(workspace.envs(), workspace.currentEnv())
  outputLine(list, output)
  return CliExitCode.Success
}

const namesRequiredCommands = ['rename']
const nameRequiredCommands = ['create', 'set', 'delete', ...namesRequiredCommands]
export const command = (
  workspaceDir: string,
  commandName: string,
  output: CliOutput,
  envName?: string,
  newEnvName?: string,
  force?: boolean,
  acceptSuggestions?: boolean,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    if (namesRequiredCommands.includes(commandName)
      && (_.isEmpty(envName) || _.isEmpty(newEnvName))) {
      errorOutputLine('Missing required argument\n\n'
      + `Example usage: salto env ${commandName} <name> <new-name>`, output)
      return CliExitCode.UserInputError
    }
    if (_.isEmpty(envName) && nameRequiredCommands.includes(commandName)) {
      errorOutputLine('Missing required argument: name\n\n'
      + `Example usage: salto env ${commandName} <name>`, output)
      return CliExitCode.UserInputError
    }
    if (!_.isEmpty(envName) && !nameRequiredCommands.includes(commandName)) {
      errorOutputLine(`Unknown argument: ${envName}\n\n`
      + `Example usage: salto env ${commandName}`, output)
      return CliExitCode.UserInputError
    }

    const workspace = await loadLocalWorkspace(workspaceDir)
    switch (commandName) {
      case 'create':
        return createEnvironment(
          envName as string,
          output,
          workspace,
          workspaceDir,
          force,
          acceptSuggestions,
        )
      case 'delete':
        return deleteEnvironment(envName as string, output, workspace)
      case 'set':
        return setEnvironment(envName as string, output, workspace)
      case 'list':
        return listEnvs(output, workspace)
      case 'current':
        return getCurrentEnv(output, workspace)
      case 'rename':
        return renameEnvironment(envName as string, newEnvName as string, output, workspace)
      default:
        errorOutputLine('Unknown environment management command', output)
        return CliExitCode.UserInputError
    }
  },
})

interface EnvsArgs {
  command: string
  name: string
  [NEW_ENV_NAME]: string
  force: boolean
  acceptSuggestions: boolean
}

type EnvsParsedCliInput = ParsedCliInput<EnvsArgs>

const envsBuilder = createCommandBuilder({
  options: {
    command: 'env <command> [<name>] [<new-name>]',
    description: 'Manage your workspace environments',
    positional: {
      command: {
        type: 'string',
        choices: ['create', 'set', 'list', 'current', 'delete', 'rename'],
        description: 'The environment management command',
      },
      name: {
        type: 'string',
        desc: 'The name of the environment (required for create, set and delete)',
      },
      [NEW_ENV_NAME]: {
        type: 'string',
        desc: 'The new name of the environment (required for rename)',
      },
    },
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Perform the action without prompting with recommendations (such as to make the current files env-specific)',
        boolean: true,
        default: false,
        demandOption: false,
      },
      // will also be available as acceptSuggestions because of camel-case-expansion
      'accept-suggestions': {
        alias: ['y'],
        describe: 'Accept all correction suggestions without prompting',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },
  async build(input: EnvsParsedCliInput, output: CliOutput) {
    return command(
      '.',
      input.args.command,
      output,
      input.args.name,
      input.args[NEW_ENV_NAME],
      input.args.force,
      input.args.acceptSuggestions,
    )
  },
})

export interface EnvironmentArgs { env: string }

export type EnvironmentParsedCliInput = ParsedCliInput<EnvironmentArgs>

export default envsBuilder
