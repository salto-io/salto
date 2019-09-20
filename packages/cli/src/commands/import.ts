import asyncfile from 'async-file'
import { importFromCsvFile, Blueprint, readCsv } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import * as bf from '../filters/blueprints'
import { getConfigFromUser } from '../callbacks'
import Prompts from '../prompts'

export const command = (blueprints: Blueprint[],
  typeName: string,
  inputPath: string,
  { stdout }: CliOutput): CliCommand => ({
  async execute(): Promise<void> {
    if (!await asyncfile.exists(inputPath)) {
      stdout.write(Prompts.IMPORT_COULD_NOT_FIND_FILE)
      return
    }
    const records = await readCsv(inputPath)
    await importFromCsvFile(
      typeName,
      records,
      blueprints,
      getConfigFromUser
    )
    // TODO: Return here the full report that contains the numbers of successful and failed rows.
    // Also: print the errors of the erronous rows to a log file and print the path of the log.
    stdout.write(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
  },
})

type DiscoverArgs = bf.Args & { 'typeName': string; 'inputPath': string }
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'import <typeName> <inputPath>',
    aliases: ['i'],
    description: 'Imports all objects of a given type from a provided CSV',
    positional: {
      typeName: {
        type: 'string',
        description: 'The type name of the instances to import as it appears in the blueprint',
      },
      inputPath: {
        type: 'string',
        description: 'A path to the input CSV file',
      },
    },
  },

  filters: [bf.optionalFilter],

  async build(input: DiscoverParsedCliInput, output: CliOutput) {
    return command(input.blueprints, input.args.typeName, input.args.inputPath, output)
  },
})

export default builder
