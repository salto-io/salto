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
import { initLocalWorkspace } from '@salto-io/core'
import Prompts from '../prompts'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode, CliTelemetry } from '../types'
import { getEnvName } from '../callbacks'
import { getWorkspaceTelemetryTags } from '../workspace/workspace'
import { getCliTelemetry } from '../telemetry'

export const command = (
  workspaceName: string | undefined,
  cliTelemetry: CliTelemetry,
  { stdout, stderr }: CliOutput,
  getEnvNameCallback: (currentEnvName?: string) => Promise<string>
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    cliTelemetry.start()
    try {
      const defaultEnvName = await getEnvNameCallback()
      const baseDir = path.resolve('.')
      const workspace = await initLocalWorkspace(baseDir, workspaceName, defaultEnvName)
      const workspaceTags = await getWorkspaceTelemetryTags(workspace)
      cliTelemetry.success(workspaceTags)
      stdout.write(
        Prompts.initCompleted(workspace.name, baseDir)
      )
    } catch (e) {
      stderr.write(Prompts.initFailed(e.message))
      cliTelemetry.failure()
      cliTelemetry.stacktrace(e)
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
    return command(
      input.args['workspace-name'],
      getCliTelemetry(input.telemetry, 'init'),
      output,
      getEnvName,
    )
  },
})

export default initBuilder
