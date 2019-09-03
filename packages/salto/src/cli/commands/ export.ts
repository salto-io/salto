import * as commands from '../commands'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { Blueprint } from '../../blueprints/blueprint'
import * as bf from '../filters/blueprints'

const command = (blueprints: Blueprint[], typeName: string, outputPath: string): CliCommand => ({
  async execute(): Promise<void> {
    return commands.exportBase(typeName, outputPath, blueprints)
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
