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

type MyParsedCliInput = ParsedCliInput<bf.ParsedArgs & { 'output-filename': string } > & bf.AddedCliInput

const builder = createCommandBuilder<bf.ParsedArgs, MyParsedCliInput>({
  options: {
    command: 'describe <words...>',
    aliases: ['d'],
    description: 'Shows all available types and attributes for the adapters of the related services',
    positional: [
      [
        'words', {
          type: 'string',
          description: 'Words to search',
          default: undefined, // Prevent "default: []" in the help
        },
      ],
    ],
  },

  filters: [bf.filter],

  async build(input: MyParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args['output-filename'])
  },
})

export default builder
