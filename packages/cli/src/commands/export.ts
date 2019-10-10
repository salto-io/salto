import path from 'path'
import { api, csv, blueprints as sbp } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import * as bf from '../filters/blueprints'
import { getConfigFromUser } from '../callbacks'

export const command = (blueprints: sbp.Blueprint[], typeName: string, outputPath: string):
CliCommand => ({
  async execute(): Promise<void> {
    const outputObjectsIterator = await api.exportToCsv(typeName, blueprints, getConfigFromUser)

    // Check if output path is provided, otherwise use the template
    // <working dir>/<typeName>_<current timestamp>.csv
    const outPath = outputPath || path.join(path.resolve('./'), `${typeName}_${Date.now()}.csv`)

    let toAppend = false
    // eslint-disable-next-line no-restricted-syntax
    for await (const objects of outputObjectsIterator) {
      await csv.dumpCsv(objects.map(instance => instance.value), outPath, toAppend)
      toAppend = true
    }
  },
})

type DiscoverArgs = bf.Args & { 'typeName': string; 'output-path': string }
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'export <typeName>',
    aliases: ['e'],
    description: 'Exports all objects of a given type to CSV',
    positional: {
      typeName: {
        type: 'string',
        description: 'The type name of the instances for export as it appears in the blueprint',
        default: undefined, // Prevent "default: []" in the help
      },
    },
    keyed: {
      'output-path': {
        alias: ['o'],
        describe: 'A path to the output CSV file',
        string: true,
        demandOption: false,
      },
    },
  },

  filters: [bf.optionalFilter],

  async build(input: DiscoverParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args.typeName, input.args['output-path'])
  },
})

export default builder
