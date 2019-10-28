import yargs from 'yargs'
import { ParsedCliInput, CliOutput, CliCommand, SpinnerCreator } from './types'
import { Filter } from './filter'

export type CommandBuilder<
  TArgs = {},
  TParsedCliInput extends ParsedCliInput<TArgs> = ParsedCliInput<TArgs>,
  > =
  // Create a CliCommand given a parsed CLI input (output of yargs parser) and output interface
  (input: TParsedCliInput, output: CliOutput, spinner: SpinnerCreator) => Promise<CliCommand>

export interface KeyedOptions { [key: string]: yargs.Options }
export interface PositionalOptions { [key: string]: yargs.PositionalOptions }

export interface YargsModuleOpts {
  // Name of this command in the CLI, e.g., 'apply'
  // If positional arguments are included, they also need to be specified here
  // See: https://github.com/yargs/yargs/blob/master/docs/advanced.md#positional-arguments
  command: string

  // Additional or shorthand names, e.g, 'a'
  aliases?: string[]

  // Description to be shown in help
  description: string

  // Positional arguments
  positional?: PositionalOptions

  // Keyed arguments
  keyed?: KeyedOptions
}

export interface YargsCommandBuilder<
  TArgs = {},
  TParsedCliInput extends ParsedCliInput<TArgs> = ParsedCliInput<TArgs>,
  > {
  // Yargs CommandModule for this command
  // See https://github.com/yargs/yargs/blob/master/docs/advanced.md#providing-a-command-module
  yargsModule: Omit<yargs.CommandModule, 'handler'>

  // Creates the actual command
  build: CommandBuilder<TArgs, TParsedCliInput>
}

export const createCommandBuilder = <
  TArgs = {},
  TParsedCliInput extends ParsedCliInput<TArgs> = ParsedCliInput<TArgs>,
>(
    { options, filters = [], build }:
    {
      options: YargsModuleOpts
      filters?: Filter[]
      build: CommandBuilder<TArgs, TParsedCliInput>
    }): YargsCommandBuilder<TArgs, TParsedCliInput> => ({

    yargsModule: {
      command: options.command,
      aliases: options.aliases,
      describe: options.description,
      builder: (parser: yargs.Argv) => {
        // apply positional arguments
        Object.entries(options.positional || {})
          .reduce((res, [key, opt]) => res.positional(key, opt), parser)

        // apply keyed arguments
        parser.options(options.keyed || {})

        // apply filters
        return Filter.applyParser(filters, parser)
      },
    },

    async build(
      input: TParsedCliInput,
      output: CliOutput,
      spinner: SpinnerCreator
    ): Promise<CliCommand> {
      const transformedInput = await Filter.applyParsedCliInput(filters, input) as TParsedCliInput
      return build(transformedInput, output, spinner)
    },
  })
