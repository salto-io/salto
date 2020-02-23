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
import { init, telemetrySender, TelemetrySender } from '@salto-io/core'
import Prompts from '../prompts'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'

export const command = (
  workspaceName: string | undefined,
  telemetry: TelemetrySender,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    try {
      telemetry.sendCountEvent('init', 1, { app: 'cli' })
      const workspace = await init(workspaceName)
      stdout.write(
        Prompts.initCompleted(workspace.config.name, path.resolve(workspace.config.baseDir))
      )
      telemetry.stop()
      await telemetry.flush()
    } catch (e) {
      stderr.write(Prompts.initFailed(e.message))
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
    const telemetry = telemetrySender(
      input.config.telemetry,
      { installationID: input.config.installationID }
    )
    telemetry.start()
    return command(input.args['workspace-name'], telemetry, output)
  },
})

export default initBuilder
