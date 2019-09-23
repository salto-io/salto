import asyncfile from 'async-file'
import { deleteFromCsvFile, Blueprint, readCsv } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import * as bf from '../filters/blueprints'
import { getConfigFromUser } from '../callbacks'
import Prompts from '../prompts'

export const command = (blueprints: Blueprint[],
  inputPath: string,
  typeName: string,
  { stdout }: CliOutput): CliCommand => ({
  async execute(): Promise<void> {
    if (!await asyncfile.exists(inputPath)) {
      stdout.write(Prompts.COULD_NOT_FIND_FILE)
      return
    }
    const records = await readCsv(inputPath)
    await deleteFromCsvFile(
      typeName,
      records,
      blueprints,
      getConfigFromUser
    )
    // TODO: Return here the full report that contains the numbers of successful and failed rows.
    // Also: print the errors of the erronous rows to a log file and print the path of the log.
    stdout.write(Prompts.DELETE_FINISHED_SUCCESSFULLY)
  },
})

type DiscoverArgs = bf.Args & { 'inputPath': string; 'typeName': string }
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'delete <inputPath> <typeName>',
    aliases: ['i'],
    description: 'deletes all objects of a given type from a provided CSV',
    positional: {
      inputPath: {
        type: 'string',
        description: 'A path to the input CSV file',
      },
      typeName: {
        type: 'string',
        description: 'The type name of the instances to delete as it appears in the blueprint',
      },
    },
  },

  filters: [bf.optionalFilter],

  async build(input: DiscoverParsedCliInput, output: CliOutput) {
    return command(input.blueprints, input.args.inputPath, input.args.typeName, output)
  },
})

export default builder
