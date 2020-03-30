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
import wu from 'wu'
import { deleteFromCsvFile, file } from '@salto-io/core'
import { environmentFilter } from '../filters/env'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode, CliTelemetry } from '../types'
import Prompts from '../prompts'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace'
import { getCliTelemetry } from '../telemetry'

export const command = (
  workingDir: string,
  typeName: string,
  inputPath: string,
  cliTelemetry: CliTelemetry,
  { stdout, stderr }: CliOutput,
  inputEnvironment?: string,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    if (!(await file.exists(inputPath))) {
      stderr.write(Prompts.COULD_NOT_FIND_FILE)
      cliTelemetry.failure()
      return CliExitCode.UserInputError
    }

    const { workspace, errored } = await loadWorkspace(
      workingDir,
      { stdout, stderr },
      { sessionEnv: inputEnvironment },
    )
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }
    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.start(workspaceTags)
    const result = await deleteFromCsvFile(
      typeName,
      inputPath,
      workspace
    )
    // Print here the full report that contains the numbers of successful and failed rows.
    stdout.write(Prompts.DELETE_ENDED_SUMMARY(result.successfulRows, result.failedRows))
    // Print the unique errors encountered during the import
    if (result.errors.size > 0) {
      cliTelemetry.errors(result.errors.size, workspaceTags)
      stdout.write(Prompts.ERROR_SUMMARY(wu(result.errors.values()).toArray()))
    }
    // If any rows failed, return error exit code
    if (result.failedRows > 0) {
      cliTelemetry.failedRows(result.failedRows, workspaceTags)
      cliTelemetry.failure(workspaceTags)
      return CliExitCode.AppError
    }
    // Otherwise return success
    stdout.write(Prompts.DELETE_FINISHED_SUCCESSFULLY)
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  },
})

type DeleteArgs = {
  'type-name': string
  'input-path': string
  env?: string
}
type DeleteParsedCliInput = ParsedCliInput<DeleteArgs>

const deleteBuilder = createCommandBuilder({
  options: {
    command: 'delete <type-name> <input-path>',
    description: 'Deletes records in the provided CSV file from the target service',
    positional: {
      'type-name': {
        type: 'string',
        description: 'The type name of the records to delete (as it appears in the blueprints)',
      },
      'input-path': {
        type: 'string',
        description: 'A path to the input CSV file',
      },
    },
  },
  filters: [environmentFilter],

  async build(input: DeleteParsedCliInput, output: CliOutput) {
    return command(
      '.',
      input.args['type-name'],
      input.args['input-path'],
      getCliTelemetry(input.telemetry, 'delete'),
      output,
      input.args.env,
    )
  },
})

export default deleteBuilder
