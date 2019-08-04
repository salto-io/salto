import yargs from 'yargs'
import { Blueprint } from '../../blueprints/blueprint'
import { ArgsFilter, ParsedCliInput } from '../types'
import { loadBlueprints } from '../blueprint'

export interface AddedCliInput {
  blueprints: Blueprint[]
}

export interface ParsedArgs {
  'blueprint': string[]
  'blueprints-dir': string
}

export const filter: ArgsFilter<ParsedArgs, AddedCliInput> = {
  transformParser(parser: yargs.Argv): yargs.Argv {
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
      })
      .check((args: yargs.Arguments): true => {
        if (!args.blueprint && !args['blueprints-dir']) {
          throw new Error('Must specify at least one of: blueprint, blueprints-dir')
        }
        return true
      })
  },

  async transformParsedCliInput(
    input: ParsedCliInput<ParsedArgs>
  ): Promise<ParsedCliInput & AddedCliInput> {
    return Object.assign(input, {
      blueprints: await loadBlueprints(input.args.blueprint || [], input.args['blueprints-dir']),
    })
  },
}
