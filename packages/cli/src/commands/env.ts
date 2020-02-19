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
import { Config, addEnvToConfig, setCurrentEnv } from '@salto-io/core'
import { CliCommand, CliExitCode, ParsedCliInput, CliOutput, SpinnerCreator } from '../types'

import { EnvsCmdArgs, envsCmdFilter } from '../filters/env'
import { loadWorkspace } from '../workspace'
import { createCommandBuilder } from '../command_builder'
import { formatEnvListItem, formatCurrentEnv, formatCreateEnv, formatSetEnv } from '../formatter'

const outputLine = ({ stdout }: CliOutput, text: string): void => stdout.write(`${text}\n`)

const setEnviornment = async (
  envName: string,
  output: CliOutput,
  config: Config
): Promise<CliExitCode> => {
  await setCurrentEnv(config, envName)
  outputLine(output, formatSetEnv(envName))
  return CliExitCode.Success
}

const createEnviornment = async (
  envName: string,
  output: CliOutput,
  config: Config
): Promise<CliExitCode> => {
  const newConfig = await addEnvToConfig(config, envName)
  await setEnviornment(envName, output, newConfig)
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
  const list = formatEnvListItem(config.envs.map(env => env.name), config.currentEnv)
  outputLine(output, list)
  return CliExitCode.Success
}

export const command = (
  workspaceDir: string,
  commandName: string | undefined,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  envName?: string,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workspaceDir,
      output, spinnerCreator)
    if (errored) {
      return CliExitCode.AppError
    }
    switch (commandName) {
      case 'create':
        return createEnviornment(envName as string, output, workspace.config)
      case 'set':
        return setEnviornment(envName as string, output, workspace.config)
      case 'list':
        return listEnvs(output, workspace.config)
      case 'current':
        return getCurrentEnv(output, workspace.config)
      default:
        throw new Error('Unknown enviornment management command')
    }
  },
})

type EnvsArgs = {} & EnvsCmdArgs

type EnvsParsedCliInput = ParsedCliInput<EnvsArgs>

const envsBuilder = createCommandBuilder({
  options: {
    command: 'env <command> [name]',
    description: 'Manage your workspace enviornments',
  },

  filters: [envsCmdFilter],
  async build(input: EnvsParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command('.', input.args.command, output, spinnerCreator, input.args.name)
  },
})

export default envsBuilder
