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

import { Config, addEnvToConfig, setCurrentEnv, loadConfig } from '@salto-io/core'
import { CliCommand, CliExitCode, ParsedCliInput, CliOutput } from '../types'

import { createCommandBuilder } from '../command_builder'
import { formatEnvListItem, formatCurrentEnv, formatCreateEnv, formatSetEnv } from '../formatter'

const outputLine = ({ stdout }: CliOutput, text: string): void => stdout.write(`${text}\n`)

const setEnvironment = async (
  envName: string,
  output: CliOutput,
  config: Config
): Promise<CliExitCode> => {
  await setCurrentEnv(config, envName)
  outputLine(output, formatSetEnv(envName))
  return CliExitCode.Success
}

const createEnvironment = async (
  envName: string,
  output: CliOutput,
  config: Config
): Promise<CliExitCode> => {
  const newConfig = await addEnvToConfig(config, envName)
  await setEnvironment(envName, output, newConfig)
  outputLine(output, formatCreateEnv(envName))
  return CliExitCode.Success
}

const getCurrentEnv = (
  output: CliOutput,
  config: Config
): CliExitCode => {
  outputLine(output, formatCurrentEnv(config.currentEnv))
  return CliExitCode.Success
}

const listEnvs = (
  output: CliOutput,
  config: Config
): CliExitCode => {
  const list = formatEnvListItem(_.keys(config.envs), config.currentEnv)
  outputLine(output, list)
  return CliExitCode.Success
}

const nameRequiredCommands = ['create', 'set']
export const command = (
  workspaceDir: string,
  commandName: string,
  output: CliOutput,
  envName?: string,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    if (_.isEmpty(envName) && nameRequiredCommands.includes(commandName)) {
      throw new Error('Missing required argument: name\n\n'
        + `Example usage: salto env ${commandName} <envName>`)
    }
    if (!_.isEmpty(envName) && !nameRequiredCommands.includes(commandName)) {
      throw new Error(`Unknown argument: ${envName}\n\n`
        + `Example usage: salto env ${commandName}`)
    }

    const workspaceConfig = await loadConfig(workspaceDir)
    switch (commandName) {
      case 'create':
        return createEnvironment(envName as string, output, workspaceConfig)
      case 'set':
        return setEnvironment(envName as string, output, workspaceConfig)
      case 'list':
        return listEnvs(output, workspaceConfig)
      case 'current':
        return getCurrentEnv(output, workspaceConfig)
      default:
        throw new Error('Unknown environment management command')
    }
  },
})

interface EnvsArgs {
  command: string
  name: string
}

type EnvsParsedCliInput = ParsedCliInput<EnvsArgs>

const envsBuilder = createCommandBuilder({
  options: {
    command: 'env <command> [name]',
    description: 'Manage your workspace environments',
    positional: {
      command: {
        type: 'string',
        choices: ['create', 'set', 'list', 'current'],
        description: 'The environment management command',
      },
      name: {
        type: 'string',
        desc: 'The name of the environment (required for create & set)',
      },
    },
  },
  async build(input: EnvsParsedCliInput, output: CliOutput) {
    return command('.', input.args.command, output, input.args.name)
  },
})

export interface EnvironmentArgs { env: string }

export type EnvironmentParsedCliInput = ParsedCliInput<EnvironmentArgs>

export default envsBuilder
