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
import _ from 'lodash'
import commander from 'commander'
import { values as ldValues } from '@salto-io/lowerdash'
import { Telemetry, CommandConfig } from '@salto-io/core'
import { LogLevel, logger, compareLogLevels } from '@salto-io/logging'
import { PositionalOption, CommandOrGroupDef, isCommand, CommandDef, CommandsGroupDef, KeyedOption } from './command_builder'
import { CliOutput, SpinnerCreator, CliExitCode, CliError } from './types'
import { versionString } from './version'

const { isDefined } = ldValues

const LIST_SUFFIX = '...'
const OPTION_NEGATION_PREFIX = 'no-'
export const VERBOSE_LOG_LEVEL: LogLevel = 'debug'
export const COMMANDER_ERROR_NAME = 'CommanderError'
export const HELP_DISPLAYED_CODE = 'commander.helpDisplayed'
export const VERSION_CODE = 'commander.version'

const increaseLoggingLogLevel = (): void => {
  const currentLogLevel = logger.config.minLevel
  const isCurrentLogLevelLower = currentLogLevel === 'none'
    || compareLogLevels(currentLogLevel, VERBOSE_LOG_LEVEL) < 0

  if (isCurrentLogLevelLower) {
    logger.setMinLevel(VERBOSE_LOG_LEVEL)
  }
}

export const createProgramCommand = (): commander.Command => (
  new commander.Command('salto')
    .version(`${versionString}\n`)
    .passCommandToAction(false)
    .exitOverride()
)

const wrapWithRequired = (innerStr: string): string =>
  (`<${innerStr}>`)

const wrapWithOptional = (innerStr: string): string =>
  (`[${innerStr}]`)

const isNegationOptions = <T>(option: KeyedOption<T>): boolean =>
  (option.type === 'boolean' && option.default === true)

const createOptionString = (
  name: string,
  type: string,
  alias?: string,
  isNegation = false
): string => {
  const actualName = isNegation ? `${OPTION_NEGATION_PREFIX}${name}` : name
  const aliasAndName = alias ? `-${alias}, --${actualName}` : `--${actualName}`
  const varDef = (type === 'boolean')
    ? ''
    // Keyed string/strinsgList options are always wrapped with <>
    // because [] is a way to define it can also be a boolean
    : (wrapWithRequired(type === 'stringsList' ? `${name}${LIST_SUFFIX}` : name))
  return `${aliasAndName} ${varDef}`
}

const positionalOptionsStr = <T>(positionalOptions: PositionalOption<T>[]): string =>
  (positionalOptions.map(positional => {
    const innerStr = positional.type === 'stringsList'
      ? `${positional.name}${LIST_SUFFIX}`
      : positional.name
    return positional.required ? wrapWithRequired(`${innerStr}`) : wrapWithOptional(`${innerStr}`)
  }).join(' '))

const createPositionalOptionsMapping = <T>(
  positionalOptions: PositionalOption<T>[],
  values: (string | string[] | undefined)[]
): Record<string, string | string[] | undefined> => {
  const positionalOptionsNames = positionalOptions.map(p => p.name)
  return Object.fromEntries(
    _.zip(positionalOptionsNames, values)
  )
}

const addKeyedOption = <T>(parentCommand: commander.Command, option: KeyedOption<T>): void => {
  const optionNameInKebabCase = _.kebabCase(option.name)
  if (optionNameInKebabCase.startsWith(OPTION_NEGATION_PREFIX)) {
    throw new Error('Options with \'no[A-Z].*\' pattern (e.g. \'noLogin\') are illegal due to commander\'s negation feature. Use default true without the no prefix instead (e.g. \'login\' with default true)')
  }
  const optionDefStr = createOptionString(
    // camelCase option names are automatically changed to kebabCase in the help
    optionNameInKebabCase,
    option.type,
    option.alias,
    // We automatically replace bools with default true (negationOptions) with 'no-*' options
    isNegationOptions(option)
  )
  if (option.required ?? false) {
    parentCommand.requiredOption(
      optionDefStr,
      option.description,
      option.default,
    )
  } else {
    // When an option is a boolean and is not required the default is false because of commander's
    // boolean behaviour (only yes/undefined is possible from user input)
    const defaultVal = option.default
      ?? (option.type === 'boolean' ? false : undefined)
    parentCommand.option(optionDefStr, option.description, defaultVal)
  }
}

const registerCommand = <T>(
  parentCommand: commander.Command,
  commandDef: CommandDef<T>,
  cliArgs: {
    telemetry: Telemetry
    config: CommandConfig
    output: CliOutput
    spinnerCreator?: SpinnerCreator
  },
): void => {
  const {
    properties: { name, description, keyedOptions = [], positionalOptions = [] },
    action,
  } = commandDef
  const command = new commander.Command()
    .passCommandToAction(false)
    .command(`${name} ${positionalOptionsStr(positionalOptions)}`)
    .exitOverride()
  command.description(description)
  positionalOptions.forEach(positionalOption =>
    // Positional options are added as non-required Options because for positional options
    // requireness derives from <> or [] in the command and not option definition
    (command.option(
      positionalOption.name,
      positionalOption.description,
      positionalOption.default,
    )))
  keyedOptions.forEach(keyedOption => addKeyedOption(command, keyedOption))
  const optionsWithChoices = [
    ...positionalOptions.filter(positionalOption => positionalOption.choices !== undefined),
    ...keyedOptions.filter(keyedOption => keyedOption.choices !== undefined),
  ]
  command.action(
    async (...inputs) => {
      const indexOfKeyedOptions = inputs.findIndex(o => _.isPlainObject(o))
      const keyedOptionsObj = inputs[indexOfKeyedOptions]

      // Handle the verbose option that is added automatically and is common for all commands
      if (keyedOptionsObj.verbose) {
        increaseLoggingLogLevel()
      }
      const positionalValues = inputs.slice(0, indexOfKeyedOptions)
      const args = {
        ...keyedOptionsObj,
        ...createPositionalOptionsMapping(positionalOptions, positionalValues),
      }

      // Validate choices enforcement
      const choicesValidationErrors = optionsWithChoices.map(optionWithChoice => {
        if (args[optionWithChoice.name] !== undefined
          && !optionWithChoice.choices?.includes(args[optionWithChoice.name])) {
          return `error: option ${optionWithChoice.name} must be one of - [${optionWithChoice.choices?.join(', ')}]\n`
        }
        return undefined
      }).filter(isDefined)
      if (!_.isEmpty(choicesValidationErrors)) {
        choicesValidationErrors.forEach(error => (cliArgs.output.stderr.write(error)))
        throw new CliError('', CliExitCode.UserInputError)
      }
      try {
        const actionResult = await action({
          ...cliArgs,
          input: args,
        })
        if (actionResult !== CliExitCode.Success) {
          throw new CliError('', actionResult)
        }
      } catch (error) {
        throw new CliError(error.message, CliExitCode.AppError)
      }
    }
  )
  parentCommand.addCommand(command)
}

const registerGroup = (
  parentCommand: commander.Command,
  containerDef: CommandsGroupDef,
  cliArgs: {
    telemetry: Telemetry
    config: CommandConfig
    output: CliOutput
    spinnerCreator?: SpinnerCreator
  },
): void => {
  const { properties, subCommands } = containerDef
  const groupCommand = new commander.Command()
    .command(properties.name)
    .description(properties.description)
    .exitOverride()
  subCommands.forEach(subCommand => {
    /* eslint-disable-next-line @typescript-eslint/no-use-before-define */
    registerCommandOrGroup(groupCommand, subCommand, cliArgs)
  })
  parentCommand.addCommand(groupCommand)
}

const registerCommandOrGroup = (
  parentCommand: commander.Command,
  commandOrGroupDef: CommandOrGroupDef,
  cliArgs: {
    telemetry: Telemetry
    config: CommandConfig
    output: CliOutput
    spinnerCreator?: SpinnerCreator
  },
): void => {
  if (isCommand(commandOrGroupDef)) {
    registerCommand(parentCommand, commandOrGroupDef, cliArgs)
  } else {
    registerGroup(parentCommand, commandOrGroupDef, cliArgs)
  }
}

export const registerCommands = (
  commanderProgram: commander.Command,
  allDefinitions: CommandOrGroupDef[],
  cliArgs: {
    telemetry: Telemetry
    config: CommandConfig
    output: CliOutput
    spinnerCreator?: SpinnerCreator
  },
): void => {
  allDefinitions.forEach(commandOrGroupDef => {
    registerCommandOrGroup(commanderProgram, commandOrGroupDef, cliArgs)
  })
}
