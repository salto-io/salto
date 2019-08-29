import * as commands from '../commands'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { Blueprint } from '../../blueprints/blueprint'
import * as bf from '../filters/blueprints'

const command = (blueprints: Blueprint[], typeId: string, outputPath: string): CliCommand => ({
  async execute(): Promise<void> {
    return commands.exportBase(typeId, outputPath, blueprints)
  },
})

type DiscoverArgs = bf.Args & { 'typeId': string; 'output-path': string }
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'export <typeId>',
    aliases: ['e'],
    description: 'Exports all objects of a given type to CSV',
    positional: {
      typeId: {
        type: 'string',
        description: 'The type id of the instances for export',
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
    return command(input.blueprints, input.args.typeId, input.args['output-path'])
  },
})

export default builder
