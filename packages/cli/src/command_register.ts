/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { CommandOrGroupDef, isCommand, CommandDef, CommandsGroupDef } from './command_builder'
import { CliArgs, PositionalOption, KeyedOption } from './types'
import { versionString } from './version'

const LIST_SUFFIX = '...'
const OPTION_NEGATION_PREFIX = 'no-'
export const COMMANDER_ERROR_NAME = 'CommanderError'
export const HELP_DISPLAYED_CODE = 'commander.helpDisplayed'
export const VERSION_CODE = 'commander.version'

export const createProgramCommand = (): commander.Command =>
  new commander.Command('salto').version(`${versionString}\n`).exitOverride().showHelpAfterError("See 'salto --help'.")

const wrapWithRequired = (innerStr: string): string => `<${innerStr}>`

const wrapWithOptional = (innerStr: string): string => `[${innerStr}]`

const isNegationOption = <T>(option: KeyedOption<T>): boolean => option.type === 'boolean' && option.default === true

const createOptionString = (name: string, type: string, alias?: string, isNegation = false): string => {
  const actualName = isNegation ? `${OPTION_NEGATION_PREFIX}${name}` : name
  const aliasAndName = alias ? `-${alias}, --${actualName}` : `--${actualName}`
  const varDef =
    type === 'boolean'
      ? ''
      : // Keyed string/stringsList options are always wrapped with <>
        // because [] is a way to define it can also be a boolean
        wrapWithRequired(type === 'stringsList' ? `${name}${LIST_SUFFIX}` : name)
  return `${aliasAndName} ${varDef}`
}

const positionalOptionsStr = <T>(positionalOptions: PositionalOption<T>[]): string =>
  positionalOptions
    .map(positional => {
      const innerStr = positional.type === 'stringsList' ? `${positional.name}${LIST_SUFFIX}` : positional.name
      return positional.required ? wrapWithRequired(`${innerStr}`) : wrapWithOptional(`${innerStr}`)
    })
    .join(' ')

const addKeyedOption = <T>(parentCommand: commander.Command, option: KeyedOption<T>): void => {
  const optionNameInKebabCase = _.kebabCase(option.name)
  if (optionNameInKebabCase.startsWith(OPTION_NEGATION_PREFIX)) {
    throw new Error(
      "Options with 'no[A-Z].*' pattern (e.g. 'noLogin') are illegal due to commander's negation feature. Use default true without the no prefix instead (e.g. 'login' with default true)",
    )
  }
  const optionDefStr = createOptionString(
    // camelCase option names are automatically changed to kebabCase in the help
    optionNameInKebabCase,
    option.type,
    option.alias,
    // We automatically replace bools with default true (negationOptions) with 'no-*' options
    isNegationOption(option),
  )
  if (option.required) {
    parentCommand.requiredOption(optionDefStr, option.description, option.default)
  } else {
    // When an option is a boolean and is not required the default is false because of commander's
    // boolean behaviour (only yes/undefined is possible from user input)
    const defaultVal = option.default ?? (option.type === 'boolean' ? false : undefined)
    parentCommand.option(optionDefStr, option.description, defaultVal)
  }
}

const registerCommand = <T>(parentCommand: commander.Command, commandDef: CommandDef<T>, cliArgs: CliArgs): void => {
  const {
    properties: { name, description, summary, keyedOptions = [], positionalOptions = [] },
    action,
  } = commandDef
  const command = new commander.Command().command(`${name} ${positionalOptionsStr(positionalOptions)}`).exitOverride()
  command.description(description)
  if (summary) {
    command.summary(summary)
  } else if (description.includes('\n')) {
    command.summary(description.split('\n')[0])
  }
  positionalOptions.forEach(positionalOption =>
    // Positional options are added as non-required Options because for positional options
    // requireness derives from <> or [] in the command and not option definition
    command.option(positionalOption.name, positionalOption.description, positionalOption.default),
  )
  keyedOptions.forEach(keyedOption => addKeyedOption(command, keyedOption))
  command.action(async (...commanderInput) => {
    await action({
      ...cliArgs,
      commanderInput,
    })
  })
  parentCommand.addCommand(command)
}

const registerGroup = (parentCommand: commander.Command, containerDef: CommandsGroupDef, cliArgs: CliArgs): void => {
  const { properties, subCommands } = containerDef
  const groupCommand = new commander.Command()
    .command(properties.name)
    .description(properties.description)
    .exitOverride()
  subCommands.forEach(subCommand => {
    /* eslint-disable-next-line no-use-before-define */
    registerCommandOrGroup(groupCommand, subCommand, cliArgs)
  })
  parentCommand.addCommand(groupCommand)
}

const registerCommandOrGroup = (
  parentCommand: commander.Command,
  commandOrGroupDef: CommandOrGroupDef,
  cliArgs: CliArgs,
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
  cliArgs: CliArgs,
): void => {
  allDefinitions.forEach(commandOrGroupDef => {
    registerCommandOrGroup(commanderProgram, commandOrGroupDef, cliArgs)
  })
}
