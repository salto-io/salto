import { importFromCsvFile, file } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { getConfigFromUser } from '../callbacks'
import Prompts from '../prompts'
import { loadWorkspace } from '../workspace'


export const command = (
  workingDir: string,
  typeName: string,
  inputPath: string,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    if (!(await file.exists(inputPath))) {
      stderr.write(Prompts.COULD_NOT_FIND_FILE)
      return CliExitCode.AppError
    }
    const { workspace, errored } = await loadWorkspace(workingDir, { stdout, stderr })
    if (errored) {
      return CliExitCode.AppError
    }
    const result = await importFromCsvFile(
      typeName,
      inputPath,
      workspace,
      getConfigFromUser
    )
    // TODO: Return here the full report that contains the numbers of successful and failed rows.
    // Also: print the errors of the erroneous rows to a log file and print the path of the log.
    stdout.write(Prompts.IMPORT_FINISHED_SUMMARY(result.successfulRows, result.failedRows))
    if (result.successfulRows > 0 || result.failedRows === 0) {
      return CliExitCode.Success
    }
    return CliExitCode.AppError
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
    return command('.', input.args['type-name'], input.args['input-path'], output)
  },
})

export default importBuilder
