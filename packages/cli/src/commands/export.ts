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
import path from 'path'
import wu from 'wu'
import { exportToCsv } from '@salto-io/core'
import Prompts from '../prompts'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace'
import { CliTelemetry, getCliTelemetry } from '../telemetry'

export const command = (
  workingDir: string,
  typeName: string,
  outputPath: string,
  cliTelemetry: CliTelemetry,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workingDir, { stdout, stderr })
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }

    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.start(workspaceTags)

    // Check if output path is provided, otherwise use the template
    // <working dir>/<typeName>_<current timestamp>.csv
    const outPath = outputPath || path.join(path.resolve('./'), `${typeName}_${Date.now()}.csv`)
    const result = await exportToCsv(typeName, outPath, workspace)
    stdout.write(Prompts.EXPORT_ENDED_SUMMARY(result.successfulRows, typeName, outputPath))
    if (result.errors.size > 0) {
      stdout.write(Prompts.ERROR_SUMMARY(wu(result.errors.values()).toArray()))
      cliTelemetry.failure(workspaceTags)
      return CliExitCode.AppError
    }
    stdout.write(Prompts.EXPORT_FINISHED_SUCCESSFULLY)
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  },
})

type ExportArgs = {
  'type-name': string
  'output-path': string
}
type ExportParsedCliInput = ParsedCliInput<ExportArgs>

const exportBuilder = createCommandBuilder({
  options: {
    command: 'export <type-name>',
    description: 'Downloads all records of the input type from the target service to a CSV file',
    positional: {
      'type-name': {
        type: 'string',
        description: 'The type name of the instances for export as it appears in the blueprint',
        default: undefined, // Prevent "default: []" in the help
      },
    },
    keyed: {
      'output-path': {
        alias: ['o'],
        describe: 'A path to the output CSV file',
        string: true,
        demandOption: false,
      },
    },
  },

  async build(input: ExportParsedCliInput, output: CliOutput) {
    return command(
      '.',
      input.args['type-name'],
      input.args['output-path'],
      getCliTelemetry(input.telemetry, 'export'),
      output,
    )
  },
})

export default exportBuilder
