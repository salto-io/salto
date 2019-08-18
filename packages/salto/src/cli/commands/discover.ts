import * as commands from '../commands'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { Blueprint } from '../../blueprints/blueprint'
import * as bf from '../filters/blueprints'

const command = (blueprints: Blueprint[], outputDir: string): CliCommand => ({
  async execute(): Promise<void> {
    return commands.discoverBase(outputDir, blueprints)
  },
})

type DiscoverArgs = bf.Args & { 'output-dir': string }
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'discover',
    aliases: ['d'],
    description: 'Generates blueprints and state files',
    keyed: {
      'output-dir': {
        alias: ['o'],
        describe: 'A path to the output blueprints directory',
        string: true,
        demandOption: true,
      },
    },
  },

  filters: [bf.optionalFilter],

  async build(input: DiscoverParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args['output-dir'])
  },
})

export default builder
