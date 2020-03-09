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
import { importFromCsvFile, file, Telemetry } from '@salto-io/core'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import Prompts from '../prompts'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace'
import { TELEMETRY } from '../constants'

const eventBaseName = 'workspace.import'
const eventStart = `${eventBaseName}.${TELEMETRY.START}`
const eventFailure = `${eventBaseName}.${TELEMETRY.FAILURE}`
const eventSuccess = `${eventBaseName}.${TELEMETRY.SUCCESS}`
const eventErrorsCount = `${eventBaseName}.errors`
const eventFailedRows = `${eventBaseName}.failed_rows`

export const command = (
  workingDir: string,
  typeName: string,
  inputPath: string,
  telemetry: Telemetry,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    if (!(await file.exists(inputPath))) {
      stderr.write(Prompts.COULD_NOT_FIND_FILE)
      telemetry.sendCountEvent(eventFailure, 1)
      return CliExitCode.AppError
    }
    const { workspace, errored } = await loadWorkspace(workingDir, { stdout, stderr })
    if (errored) {
      telemetry.sendCountEvent(eventFailure, 1)
      return CliExitCode.AppError
    }

    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    telemetry.sendCountEvent(eventStart, 1, workspaceTags)
    const result = await importFromCsvFile(
      typeName,
      inputPath,
      workspace
    )
    // Print the full report that contains the numbers of successful and failed rows.
    stdout.write(Prompts.IMPORT_ENDED_SUMMARY(result.successfulRows, result.failedRows))
    // Print the unique errors encountered during the import
    if (result.errors.size > 0) {
      telemetry.sendCountEvent(eventErrorsCount, result.errors.size, workspaceTags)
      stdout.write(Prompts.ERROR_SUMMARY(wu(result.errors.values()).toArray()))
    }
    // If any rows failed, return error exit code
    if (result.failedRows > 0) {
      telemetry.sendCountEvent(eventFailedRows, result.failedRows, workspaceTags)
      telemetry.sendCountEvent(eventFailure, 1, workspaceTags)
      return CliExitCode.AppError
    }
    // Otherwise return success
    stdout.write(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
    telemetry.sendCountEvent(eventSuccess, 1, workspaceTags)
    return CliExitCode.Success
  },
})

type ImportArgs = {
  'type-name': string
  'input-path': string
}
type ImportParsedCliInput = ParsedCliInput<ImportArgs>

const importBuilder = createCommandBuilder({
  options: {
    command: 'import <type-name> <input-path>',
    description: 'Uploads all records of the input type from a CSV file to the target service',
    positional: {
      'type-name': {
        type: 'string',
        description: 'Type name as it appears in the blueprint',
      },
      'input-path': {
        type: 'string',
        description: 'A path to an input CSV file',
      },
    },
  },

  async build(input: ImportParsedCliInput, output: CliOutput) {
    return command('.', input.args['type-name'], input.args['input-path'], input.telemetry, output)
  },
})

export default importBuilder
