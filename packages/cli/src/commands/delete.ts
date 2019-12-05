import { deleteFromCsvFile, file } from 'salto'
import wu from 'wu'
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
      return CliExitCode.UserInputError
    }

    const { workspace, errored } = await loadWorkspace(workingDir, { stdout, stderr })
    if (errored) {
      return CliExitCode.AppError
    }
    const result = await deleteFromCsvFile(
      typeName,
      inputPath,
      workspace,
      getConfigFromUser
    )
    // Print here the full report that contains the numbers of successful and failed rows.
    stdout.write(Prompts.DELETE_FINISHED_SUMMARY(result.successfulRows, result.failedRows))
    // Print the unique errors encountered during the import
    if (result.errors.size > 0) {
      stdout.write(Prompts.ERROR_SUMMARY(wu(result.errors.values()).toArray()))
    }
    // If any rows failed, return error exit code
    if (result.failedRows > 0) {
      return CliExitCode.AppError
    }
    // Otherwise return success
    return CliExitCode.Success
  },
})

type DeleteArgs = {
  'type-name': string
  'input-path': string
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

  async build(input: DeleteParsedCliInput, output: CliOutput) {
    return command(
      '.',
      input.args['type-name'],
      input.args['input-path'],
      output
    )
  },
})

export default deleteBuilder
