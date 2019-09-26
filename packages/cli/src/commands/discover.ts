import path from 'path'
import { Blueprint, dumpBlueprints, discover } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import * as bf from '../filters/blueprints'
import { getConfigFromUser } from '../callbacks'

export const command = (blueprints: Blueprint[], outputDir: string): CliCommand => ({
  async execute(): Promise<void> {
    const outputBPs = await discover(blueprints, getConfigFromUser)
    outputBPs.forEach(bp => { bp.filename = path.join(outputDir, `${bp.filename}.bp`) })
    await dumpBlueprints(outputBPs)
  },
})

type DiscoverArgs = bf.Args & { 'output-dir': string }
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'discover',
    aliases: ['dis'],
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
