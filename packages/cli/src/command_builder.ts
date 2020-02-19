/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
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
  // Name of this command in the CLI, e.g., 'deploy'
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
        // deploy positional arguments
        Object.entries(options.positional || {})
          .reduce((res, [key, opt]) => res.positional(key, opt), parser)

        // apply keyed arguments
        parser.options(options.keyed || {})
        parser.version(false)

        // apply filters
        return Filter.applyParser(filters, parser)
      },
    },
    async build(
      input: TParsedCliInput,
      output: CliOutput,
      spinnerCreator: SpinnerCreator
    ): Promise<CliCommand> {
      const transformedInput = await Filter.applyParsedCliInput(filters, input) as TParsedCliInput
      return build(transformedInput, output, spinnerCreator)
    },
  })
