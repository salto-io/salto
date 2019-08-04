import _ from 'lodash'
import yargs from 'yargs'
import requireDirectory from 'require-directory'
import { PromiseWithState, promiseWithState } from '../promise/promise'
import {
  CommandBuilder, ParsedCliInput, ArgsFilter, CliOutput,
  CliCommand, YargsModuleOpts, YargsCommandBuilder,
} from './types'

const transformParsedInput = (
  input: ParsedCliInput, filters: ArgsFilter[]
): Promise<ParsedCliInput> => (
  filters.length
    ? filters[0].transformParsedCliInput(input).then(
      transformedInput => transformParsedInput(transformedInput, filters.slice(1))
    )
    : Promise.resolve(input)
)

export const createCommandBuilder = <
  TParsedArgs,
  TParsedCliInput extends ParsedCliInput<TParsedArgs>,
>({ options, filters = [], build }: {
  options: YargsModuleOpts
  filters?: ArgsFilter[]
  build: CommandBuilder<TParsedArgs, TParsedCliInput>
}): YargsCommandBuilder<TParsedArgs, TParsedCliInput> => ({
    yargsModule: {
      command: options.command,
      aliases: options.aliases,
      describe: options.description,
      builder: (parser: yargs.Argv) => {
        // apply positional arguments
        (options.positional || []).reduce((res, [key, opt]) => res.positional(key, opt), parser)
        // apply keyed arguments
        parser.options(options.keyed || {})
        // apply filters
        filters.reduce((res, filter) => filter.transformParser(res), parser)
        return parser
      },
    },

    async build(input: TParsedCliInput, output: CliOutput): Promise<CliCommand> {
      const transformedInput = await transformParsedInput(input, filters) as TParsedCliInput
      return build(transformedInput, output)
    },
  })

const registerBuilder = (
  yargsParser: yargs.Argv, { yargsModule, build }: YargsCommandBuilder
): Promise<CommandBuilder> =>
  new Promise<CommandBuilder>(resolved => yargsParser.command({
    ...yargsModule,
    handler: () => resolved(build),
  }))

const extractBuilderFromNodeModule = (
  module: { default: YargsCommandBuilder }
): YargsCommandBuilder => module.default

export const allBuilders = _.values(requireDirectory(
  module,
  './commands',
  { visit: extractBuilderFromNodeModule }
)) as YargsCommandBuilder[]

export const registerBuilders = (
  parser: yargs.Argv, builders: YargsCommandBuilder[] = allBuilders
): PromiseWithState<CommandBuilder> =>
  promiseWithState(Promise.race(builders.map(builder => registerBuilder(parser, builder))))
