import { deleteFromCsvFile, readCsv, file } from 'salto'
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

    const records = await readCsv(inputPath)
    const { workspace, errored } = await loadWorkspace(workingDir, { stdout, stderr })
    if (errored) {
      return CliExitCode.AppError
    }
    await deleteFromCsvFile(
      typeName,
      records,
      workspace,
      getConfigFromUser
    )
    // TODO: Return here the full report that contains the numbers of successful and failed rows.
    // Also: print the errors of the erronous rows to a log file and print the path of the log.
    stdout.write(Prompts.DELETE_FINISHED_SUCCESSFULLY)

    return CliExitCode.Success
  },
})

type DeleteArgs = {
  'type-name': string
  'input-path': string
  'blueprint': string[]
  'blueprints-dir': string
}
type DeleteParsedCliInput = ParsedCliInput<DeleteArgs>

const deleteBuilder = createCommandBuilder({
  options: {
    command: 'delete <type-name> <input-path>',
    aliases: ['del'],
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
    keyed: {
      'blueprints-dir': {
        alias: 'd',
        describe: 'A path to the blueprints directory',
        string: true,
        demandOption: true,
      },
      blueprint: {
        alias: 'b',
        describe: 'Path to input blueprint file. This option can be specified multiple times',
        demandOption: false,
        array: true,
        requiresArg: true,
      },
    },
  },


  async build(input: DeleteParsedCliInput, output: CliOutput) {
    return command(
      input.args['blueprints-dir'],
      input.args['type-name'],
      input.args['input-path'],
      output
    )
  },
})

export default deleteBuilder
