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
import * as path from 'path'
import { init, Telemetry } from '@salto-io/core'
import Prompts from '../prompts'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { getEnvName } from '../callbacks'
import { getWorkspaceTelemetryTags } from '../workspace'
import { getEvents } from '../telemetry'

const telemetryEvents = getEvents('init')

export const command = (
  workspaceName: string | undefined,
  telemetry: Telemetry,
  { stdout, stderr }: CliOutput,
  getEnvNameCallback: (currentEnvName?: string) => Promise<string>
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    telemetry.sendCountEvent(telemetryEvents.start, 1)
    try {
      const defaultEnvName = await getEnvNameCallback()
      const workspace = await init(defaultEnvName, workspaceName)
      const workspaceTags = await getWorkspaceTelemetryTags(workspace)
      telemetry.sendCountEvent(telemetryEvents.success, 1, workspaceTags)
      stdout.write(
        Prompts.initCompleted(workspace.config.name, path.resolve(workspace.config.baseDir))
      )
    } catch (e) {
      stderr.write(Prompts.initFailed(e.message))
      telemetry.sendCountEvent(telemetryEvents.failure, 1)
      telemetry.sendStackEvent(telemetryEvents.failure, e)
      return CliExitCode.AppError
    }
    return CliExitCode.Success
  },
})

type InitArgs = {
  'workspace-name': string
}

type InitParsedCliInput = ParsedCliInput<InitArgs>

const initBuilder = createCommandBuilder({
  options: {
    command: 'init [workspace-name]',
    description: 'Creates a new Salto workspace in the current directory',
    positional: {
      'workspace-name': {
        type: 'string',
        description: 'The name of the workspace',
        default: undefined, // Prevent "default: []" in the help
      },
    },
  },

  async build(input: InitParsedCliInput, output: CliOutput) {
    return command(input.args['workspace-name'], input.telemetry, output, getEnvName)
  },
})

export default initBuilder
