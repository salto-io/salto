import * as commands from '../commands'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { Blueprint } from '../../blueprints/blueprint'
import * as bf from '../filters/blueprints'

const command = (blueprints: Blueprint[], outputFilename: string): CliCommand => ({
  async execute(): Promise<void> {
    return commands.discoverBase(outputFilename, blueprints)
  },
})

type DescribeArgs = bf.Args & { 'output-filename': string }
type DescribeParsedCliInput = ParsedCliInput<DescribeArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'describe <words...>',
    aliases: ['d'],
    description: 'Shows all available types and attributes for the adapters of the related services',
    positional: {
      words: {
        type: 'string',
        description: 'Words to search',
        default: undefined, // Prevent "default: []" in the help
      },
    },
  },

  filters: [bf.requiredFilter],

  async build(input: DescribeParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args['output-filename'])
  },
})

export default builder
