/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import { types, values } from '@salto-io/lowerdash'
import { logger, compareLogLevels, LogLevel } from '@salto-io/logging'
import { CommandConfig } from '@salto-io/core'
import { CliOutput, SpinnerCreator, CliExitCode, CliTelemetry, CliError, CliArgs } from './types'
import { VERBOSE_OPTION } from './commands/common/options'
import { getCliTelemetry } from './telemetry'

const { isDefined } = values

const VERBOSE_LOG_LEVEL: LogLevel = 'debug'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type CommandOrGroupDef = CommandsGroupDef | CommandDef<any>

type BasicCommandProperties = {
  name: string
  description: string
}

export type CommandsGroupDef = {
  properties: BasicCommandProperties
  subCommands: CommandOrGroupDef[]
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type CommandAction = (args: CliArgs & { commanderInput: any[] }) => Promise<void>

export type CommandDef<T> = {
  properties: CommandOptions<T>
  action: CommandAction
}

type DefActionInput<T> = {
  input: T
  output: CliOutput
  cliTelemetry: CliTelemetry
  config: CommandConfig
  spinnerCreator?: SpinnerCreator
  workspacePath?: string
}

export type CommandDefAction<T> = (args: DefActionInput<T>) => Promise<CliExitCode>

type CommandInnerDef<T> = {
  properties: CommandOptions<T>
  action: CommandDefAction<T>
}

export const isCommand = (c?: CommandOrGroupDef): c is CommandDef<unknown> =>
  (c !== undefined && 'action' in c)

type CommandOptions<T> = BasicCommandProperties & {
  aliases?: string[]
  keyedOptions?: KeyedOption<T>[]
  positionalOptions?: PositionalOption<T>[]
}

type OptionType = {
  boolean: boolean
  string: string
  stringsList: string[]
}

type GetTypeEnumValue<T> = types.KeysOfExtendingType<OptionType, T>

// TODO: Remove this when default string[] is allowed in Commander
type GetOptionsDefaultType<T> = T extends string[] ? never : T

type PossiblePositionalArgs<T> = types.KeysOfExtendingType<T, string | string[] | undefined>

type ChoicesType<T> = T extends string ? string[] : never

export type PositionalOption<T, Name = PossiblePositionalArgs<T>>
  = Name extends PossiblePositionalArgs<T> ? {
  name: Name & string
  required: boolean
  description?: string
  type: Exclude<GetTypeEnumValue<T[Name]>, 'boolean'>
  default?: GetOptionsDefaultType<T[Name]> & (string | boolean)
  choices?: ChoicesType<T[Name]>
} : never

export type KeyedOption<T, Name extends keyof T = keyof T> = Name extends keyof T ? {
  name: Name & string
  required?: boolean
  description?: string
  alias?: string
  type: GetTypeEnumValue<T[Name]>
  default?: GetOptionsDefaultType<T[Name]> & (string | boolean)
  choices?: ChoicesType<T[Name]>
} : never

const createPositionalOptionsMapping = <T>(
  positionalOptions: PositionalOption<T>[],
  vals: (string | string[] | undefined)[]
): Record<string, string | string[] | undefined> => {
  const positionalOptionsNames = positionalOptions.map(p => p.name)
  return Object.fromEntries(
    _.zip(positionalOptionsNames, vals)
  )
}

const increaseLoggingLogLevel = (): void => {
  const currentLogLevel = logger.config.minLevel
  const isCurrentLogLevelLower = currentLogLevel === 'none'
    || compareLogLevels(currentLogLevel, VERBOSE_LOG_LEVEL) < 0

  if (isCurrentLogLevelLower) {
    logger.setMinLevel(VERBOSE_LOG_LEVEL)
  }
}

const validateChoices = <T>(
  positionalOptions: PositionalOption<T>[],
  keyedOptions: KeyedOption<T>[],
  output: CliOutput,
  args: T,
): void => {
  const optionsWithChoices = [
    ...positionalOptions,
    ...keyedOptions,
  ].filter(option => option.choices !== undefined)
  const choicesValidationErrors = optionsWithChoices.map(optionWithChoice => {
    if (args[optionWithChoice.name] !== undefined
      && !optionWithChoice.choices?.includes(String(args[optionWithChoice.name]))) {
      return `error: option ${optionWithChoice.name} must be one of - [${optionWithChoice.choices?.join(', ')}]\n`
    }
    return undefined
  }).filter(isDefined)
  if (!_.isEmpty(choicesValidationErrors)) {
    choicesValidationErrors.forEach(error => (output.stderr.write(error)))
    throw new CliError(CliExitCode.UserInputError)
  }
}

const validateCommandFlagDefinitions = <T>(
  { name, keyedOptions, positionalOptions }: CommandOptions<T>
): void => {
  const allFlags = [...(keyedOptions ?? []), ...(positionalOptions ?? [])]
  const repeatingNames = Object.keys(
    _.pickBy(
      _.groupBy(allFlags, opt => opt.name),
      flags => flags.length > 1,
    )
  )
  if (repeatingNames.length > 0) {
    throw new Error(
      `Command ${name} has multiple definitions of the following flag names ${repeatingNames.join(', ')}`
    )
  }

  const repeatingAliases = _.pickBy(
    _.groupBy(
      (keyedOptions ?? []).filter(opt => opt.alias !== undefined),
      opt => opt.alias,
    ),
    flags => flags.length > 1,
  )

  if (!_.isEmpty(repeatingAliases)) {
    const aliasErrors = Object.entries(repeatingAliases)
      .map(([alias, flags]) => `alias=${alias} flags=${flags.map(flag => flag.name).join(',')}`)
    throw new Error(
      `Command ${name} has multiple definitions of flags with the same alias:\n${aliasErrors.join('\n')}`
    )
  }
}

export const createPublicCommandDef = <T>(def: CommandInnerDef<T>): CommandDef<T> => {
  const {
    properties: { name, description, keyedOptions = [], positionalOptions = [] },
    action,
  } = def
  const commanderAction: CommandAction = async ({
    commanderInput,
    config,
    output,
    spinnerCreator,
    telemetry,
  }): Promise<void> => {
    const indexOfKeyedOptions = commanderInput.findIndex(o => _.isPlainObject(o))
    const keyedOptionsObj = commanderInput[indexOfKeyedOptions]

    // Handle the verbose option that is added automatically and is common for all commands
    if (keyedOptionsObj.verbose) {
      increaseLoggingLogLevel()
    }
    const positionalValues = commanderInput.slice(0, indexOfKeyedOptions)
    const input = {
      ...keyedOptionsObj,
      ...createPositionalOptionsMapping(positionalOptions, positionalValues),
    }
    validateChoices(positionalOptions, keyedOptions, output, input)
    const cliTelemetry = getCliTelemetry(telemetry, def.properties.name)
    const actionResult = await action({
      input, cliTelemetry, config, output, spinnerCreator,
    })
    if (actionResult !== CliExitCode.Success) {
      throw new CliError(actionResult)
    }
  }

  // Add verbose to all commands
  const properties = {
    ...{ name, description, positionalOptions },
    keyedOptions: [
      ...keyedOptions,
      VERBOSE_OPTION as KeyedOption<T>,
    ],
  }
  validateCommandFlagDefinitions(properties)
  return {
    properties,
    action: commanderAction,
  }
}

export const createCommandGroupDef = (def: CommandsGroupDef): CommandsGroupDef => def
