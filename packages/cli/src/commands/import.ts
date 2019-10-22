import asyncfile from 'async-file'
import { importFromCsvFile, Workspace, readCsv } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { getConfigFromUser } from '../callbacks'
import Prompts from '../prompts'

export const command = (
  workingDir: string,
  blueprintFiles: string[] = [],
  typeName: string,
  inputPath: string,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
    if (!await asyncfile.exists(inputPath)) {
      stderr.write(Prompts.COULD_NOT_FIND_FILE)
      return
    }
    const records = await readCsv(inputPath)
    const workspace: Workspace = await Workspace.load(workingDir, blueprintFiles)

    await importFromCsvFile(
      typeName,
      records,
      workspace,
      getConfigFromUser
    )
    // TODO: Return here the full report that contains the numbers of successful and failed rows.
    // Also: print the errors of the erronous rows to a log file and print the path of the log.
    stdout.write(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
  },
})

type ImportArgs = {
    'blueprint': string[]
    'blueprints-dir': string
    'type-name': string
    'input-path': string
  }
type ImportParsedCliInput = ParsedCliInput<ImportArgs>

const builder = createCommandBuilder({
  options: {
    orderRank: 6,
    command: 'import <type-name> <input-path>',
    aliases: ['i'],
    description: 'Imports all object instances of a specific type from a CSV',
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

  async build(input: ImportParsedCliInput, output: CliOutput) {
    return command(input.args['blueprints-dir'], input.args.blueprint, input.args['type-name'], input.args['input-path'], output)
  },
})

export default builder
