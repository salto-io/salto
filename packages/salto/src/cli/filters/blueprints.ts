import yargs from 'yargs'
import { Blueprint } from '../../blueprints/blueprint'
import { ParsedCliInput } from '../types'
import { loadBlueprints } from '../blueprint'
import { ParserFilter, ParsedCliInputFilter } from '../filter'

export interface Args {
  'blueprint': string[]
  'blueprints-dir': string
}

export type BlueprintsParsedCliInput = ParsedCliInput<Args> & { blueprints: Blueprint[] }

type BlueprintsFilter = ParserFilter<Args> & ParsedCliInputFilter<Args, BlueprintsParsedCliInput>

export const optionalFilter: BlueprintsFilter = {
  transformParser(parser: yargs.Argv): yargs.Argv<Args> {
    return parser
      .options({
        'blueprints-dir': {
          alias: 'd',
          describe: 'Path to directory containing blueprint (.bp) files',
          demandOption: false,
          string: true,
          requiresArg: true,
        },

        blueprint: {
          alias: 'b',
          describe: 'Path to input blueprint file. This option can be specified multiple times',
          demandOption: false,
          array: true,
          requiresArg: true,
        },
      }) as yargs.Argv<Args>
  },

  async transformParsedCliInput(input: ParsedCliInput<Args>): Promise<BlueprintsParsedCliInput> {
    const args = input.args as yargs.Arguments<Args>
    const blueprints = await loadBlueprints(args.blueprint || [], args['blueprints-dir'])
    return Object.assign(input, { blueprints })
  },
}

export const requiredFilter: BlueprintsFilter = Object.assign({}, optionalFilter, {
  transformParser(parser: yargs.Argv): yargs.Argv<Args> {
    return optionalFilter.transformParser(parser)
      .check((args: yargs.Arguments<Args>): true => {
        if (!args.blueprint && !args['blueprints-dir']) {
          throw new Error('Must specify at least one of: blueprint, blueprints-dir')
        }
        return true
      })
  },
})
