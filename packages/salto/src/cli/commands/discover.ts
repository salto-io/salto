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

type Args = bf.Args & { 'output-filename': string }
type MyParsedCliInput = ParsedCliInput<Args> & bf.MyParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'discover',
    aliases: ['d'],
    description: 'Generates blueprints and state files',
    keyed: {
      'output-filename': {
        alias: ['o'],
        describe: 'A path to the output blueprint file',
        string: true,
        demandOption: true,
      },
    },
  },

  filters: [bf.optionalFilter],

  async build(input: MyParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args['output-filename'])
  },
})

export default builder
