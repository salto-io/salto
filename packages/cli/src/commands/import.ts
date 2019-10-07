import asyncfile from 'async-file'
import { importFromCsvFile, Workspace, readCsv } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { getConfigFromUser } from '../callbacks'
import Prompts from '../prompts'

export const command = (
  workingDir: string,
  blueprintFiles: string[] = [],
  inputPath: string,
  typeName: string,
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
    inputPath: string
    typeName: string
  }
type ImportParsedCliInput = ParsedCliInput<ImportArgs>

const builder = createCommandBuilder({
  options: {
    command: 'import <inputPath> <typeName>',
    aliases: ['i'],
    description: 'Imports all objects of a given type from a provided CSV',
    positional: {
      inputPath: {
        type: 'string',
        description: 'A path to the input CSV file',
      },
      typeName: {
        type: 'string',
        description: 'The type name of the instances to import as it appears in the blueprint',
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
    return command(input.args['blueprints-dir'], input.args.blueprint, input.args.inputPath, input.args.typeName, output)
  },
})

export default builder
