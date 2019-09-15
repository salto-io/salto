import asyncfile from 'async-file'
import { importFromCsvFile } from '../../core/commands'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { Blueprint } from '../../core/blueprint'
import * as bf from '../filters/blueprints'
import { getConfigFromUser } from '../callbacks'

const command = (blueprints: Blueprint[], inputPath: string, typeName: string): CliCommand => ({
  async execute(): Promise<void> {
    if (!await asyncfile.exists(inputPath)) {
      throw new Error('Could not find the input file. Make sure the path you provided is correct.')
    }
    const csvFileIn = asyncfile.createReadStream(inputPath)
    await importFromCsvFile(
      typeName,
      csvFileIn,
      blueprints,
      getConfigFromUser
    )
  },
})

type DiscoverArgs = bf.Args & { 'inputPath': string; 'typeName': string }
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'import <inputPath> <typeName>',
    aliases: ['i'],
    description: 'Imports all objects of a given type from a provided CSV',
    positional: {
      inputPath: {
        type: 'string',
        description: 'A path to the input CSV file',
        default: undefined, // Prevent "default: []" in the help
      },
      typeName: {
        type: 'string',
        description: 'The type name of the instances to import as it appears in the blueprint',
        default: undefined, // Prevent "default: []" in the help
      },
    },
  },

  filters: [bf.optionalFilter],

  async build(input: DiscoverParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args.inputPath, input.args.typeName)
  },
})

export default builder
