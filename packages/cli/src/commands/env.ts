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
import { Workspace, loadLocalWorkspace } from '@salto-io/core'
import { CliCommand, CliExitCode, ParsedCliInput, CliOutput } from '../types'

import { createCommandBuilder } from '../command_builder'
import { formatEnvListItem, formatCurrentEnv, formatCreateEnv, formatSetEnv, formatDeleteEnv, formatRenameEnv } from '../formatter'

const outputLine = ({ stdout }: CliOutput, text: string): void => stdout.write(`${text}\n`)

const setEnvironment = async (
  envName: string,
  output: CliOutput,
  workspace: Workspace,
): Promise<CliExitCode> => {
  await workspace.setCurrentEnv(envName)
  outputLine(output, formatSetEnv(envName))
  return CliExitCode.Success
}

const createEnvironment = async (
  envName: string,
  output: CliOutput,
  workspace: Workspace,
): Promise<CliExitCode> => {
  await workspace.addEnvironment(envName)
  await setEnvironment(envName, output, workspace)
  outputLine(output, formatCreateEnv(envName))
  return CliExitCode.Success
}

const deleteEnvironment = async (
  envName: string,
  output: CliOutput,
  workspace: Workspace,
): Promise<CliExitCode> => {
  await workspace.deleteEnvironment(envName)
  outputLine(output, formatDeleteEnv(envName))
  return CliExitCode.Success
}

const renameEnvironment = async (
  currentEnvName: string,
  newEnvName: string,
  output: CliOutput,
  workspace: Workspace,
): Promise<CliExitCode> => {
  if (!workspace.envs().includes(currentEnvName)) {
    throw new Error(`Failed to rename unexist environment - ${currentEnvName}`)
  }
  await workspace.renameEnvironment(currentEnvName, newEnvName)
  outputLine(output, formatRenameEnv(currentEnvName, newEnvName))
  return CliExitCode.Success
}

const getCurrentEnv = (
  output: CliOutput,
  workspace: Workspace,
): CliExitCode => {
  outputLine(output, formatCurrentEnv(workspace.currentEnv()))
  return CliExitCode.Success
}

const listEnvs = (
  output: CliOutput,
  workspace: Workspace,
): CliExitCode => {
  const list = formatEnvListItem(workspace.envs(), workspace.currentEnv())
  outputLine(output, list)
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
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    if (namesRequiredCommands.includes(commandName)
      && (_.isEmpty(envName) || _.isEmpty(newEnvName))) {
      throw new Error('Missing required argument\n\n'
        + `Example usage: salto env ${commandName} <envName> <newEnvName>`)
    }
    if (_.isEmpty(envName) && nameRequiredCommands.includes(commandName)) {
      throw new Error('Missing required argument: name\n\n'
        + `Example usage: salto env ${commandName} <envName>`)
    }
    if (!_.isEmpty(envName) && !nameRequiredCommands.includes(commandName)) {
      throw new Error(`Unknown argument: ${envName}\n\n`
        + `Example usage: salto env ${commandName}`)
    }

    const workspace = await loadLocalWorkspace(workspaceDir)
    switch (commandName) {
      case 'create':
        return createEnvironment(envName as string, output, workspace)
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
        throw new Error('Unknown environment management command')
    }
  },
})

interface EnvsArgs {
  command: string
  name: string
  newName: string
}

type EnvsParsedCliInput = ParsedCliInput<EnvsArgs>

const envsBuilder = createCommandBuilder({
  options: {
    command: 'env <command> [name] [newName]',
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
      newName: {
        type: 'string',
        desc: 'The new name of the environment (required for rename)',
      },
    },
  },
  async build(input: EnvsParsedCliInput, output: CliOutput) {
    return command('.', input.args.command, output, input.args.name, input.args.newName)
  },
})

export interface EnvironmentArgs { env: string }

export type EnvironmentParsedCliInput = ParsedCliInput<EnvironmentArgs>

export default envsBuilder
