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
import { values } from '@salto-io/lowerdash'
import { logger, compareLogLevels, LogLevel } from '@salto-io/logging'
import { Workspace } from '@salto-io/workspace'
import { loadLocalWorkspace, Tags } from '@salto-io/core'
import { CliOutput, CliExitCode, CliError, PositionalOption, KeyedOption, CliArgs, CliTelemetry } from './types'
import { getCliTelemetry } from './telemetry'
import { getWorkspaceTelemetryTags } from './workspace/workspace'
import { VERBOSE_OPTION } from './commands/common/options'
import { CONFIG_OVERRIDE_OPTION, ConfigOverrideArg, getConfigOverrideChanges } from './commands/common/config_override'

const { isDefined } = values
const log = logger(module)

const VERBOSE_LOG_LEVEL: LogLevel = 'debug'

type BasicCommandProperties = {
  name: string
  // full description shown when running -h on command
  description: string
  // short description shown when running -h on parent command (if needed)
  summary?: string
}

export type CommandOptions<T> = BasicCommandProperties & {
  aliases?: string[]
  keyedOptions?: KeyedOption<T>[]
  positionalOptions?: PositionalOption<T>[]
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type CommandAction = (args: CliArgs & { commanderInput: any[] }) => Promise<void>

export type CommandsGroupDef = {
  properties: BasicCommandProperties
  // eslint-disable-next-line no-use-before-define
  subCommands: CommandOrGroupDef[]
}

export type CommandDef<T> = {
  properties: CommandOptions<T>
  action: CommandAction
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type CommandOrGroupDef = CommandsGroupDef | CommandDef<any>

export type CommandArgs = Omit<CliArgs, 'telemetry'> & { cliTelemetry: CliTelemetry }

type DefActionInput<T> = CommandArgs & { input: T }

export type CommandDefAction<T> = (args: DefActionInput<T>) => Promise<CliExitCode>

type CommandInnerDef<T> = {
  properties: CommandOptions<T>
  action: CommandDefAction<T>
}

export type WorkspaceCommandArgs<T> = Omit<DefActionInput<T>, 'workspacePath'> & { workspace: Workspace }

export type WorkspaceCommandAction<T> = (args: WorkspaceCommandArgs<T>) => Promise<CliExitCode>

export type WorkspaceCommandDef<T> = {
  properties: CommandOptions<T>
  action: WorkspaceCommandAction<T>
  extraTelemetryTags?: (args: { workspace: Workspace; input: T }) => Tags
}

export const isCommand = (c?: CommandOrGroupDef): c is CommandDef<unknown> => c !== undefined && 'action' in c

const createPositionalOptionsMapping = <T>(
  positionalOptions: PositionalOption<T>[],
  vals: (string | string[] | undefined)[],
): Record<string, string | string[] | undefined> => {
  const positionalOptionsNames = positionalOptions.map(p => p.name)
  return Object.fromEntries(_.zip(positionalOptionsNames, vals))
}

const increaseLoggingLogLevel = (): void => {
  const currentLogLevel = logger.config.minLevel
  const isCurrentLogLevelLower = currentLogLevel === 'none' || compareLogLevels(currentLogLevel, VERBOSE_LOG_LEVEL) < 0

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
  const optionsWithChoices = [...positionalOptions, ...keyedOptions].filter(option => option.choices !== undefined)
  const choicesValidationErrors = optionsWithChoices
    .map(optionWithChoice => {
      if (
        args[optionWithChoice.name] !== undefined &&
        !optionWithChoice.choices?.includes(String(args[optionWithChoice.name]))
      ) {
        return `error: option ${optionWithChoice.name} must be one of - [${optionWithChoice.choices?.join(', ')}]\n`
      }
      return undefined
    })
    .filter(isDefined)
  if (!_.isEmpty(choicesValidationErrors)) {
    choicesValidationErrors.forEach(error => output.stderr.write(error))
    throw new CliError(CliExitCode.UserInputError)
  }
}

const validateCommandOptionDefinitions = <T>(
  name: string,
  positionalOptions: PositionalOption<T>[],
  keyedOptions: KeyedOption<T>[],
): void => {
  const repeatingNames = Object.keys(
    _.pickBy(
      _.groupBy([...keyedOptions, ...positionalOptions], option => option.name),
      options => options.length > 1,
    ),
  )
  if (repeatingNames.length > 0) {
    throw new Error(
      `Command ${name} has multiple definitions of the following option names ${repeatingNames.join(', ')}`,
    )
  }

  const repeatingAliases = _.pickBy(
    _.groupBy(
      keyedOptions.filter(option => option.alias !== undefined),
      option => option.alias,
    ),
    options => options.length > 1,
  )

  if (!_.isEmpty(repeatingAliases)) {
    const aliasErrors = Object.entries(repeatingAliases).map(
      ([alias, options]) => `alias=${alias} options=${options.map(option => option.name).join(',')}`,
    )
    throw new Error(
      `Command ${name} has multiple definitions of options with the same alias:\n${aliasErrors.join('\n')}`,
    )
  }
}

export const createPublicCommandDef = <T>(def: CommandInnerDef<T>): CommandDef<T> => {
  const {
    properties: { name, description, summary, keyedOptions = [], positionalOptions = [] },
    action,
  } = def
  const commanderAction: CommandAction = async ({
    commanderInput,
    config,
    output,
    spinnerCreator,
    telemetry,
    workspacePath,
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
    log.debug('Running command %s in path %s with arguments %o', def.properties.name, workspacePath, input)
    const actionResult = await action({
      input,
      cliTelemetry,
      config,
      output,
      spinnerCreator,
      workspacePath,
    })
    if (actionResult !== CliExitCode.Success) {
      throw new CliError(actionResult)
    }
  }

  // Add verbose to all commands
  const properties = {
    ...{ name, description, summary, positionalOptions },
    keyedOptions: [...keyedOptions, VERBOSE_OPTION as KeyedOption<T>],
  }
  validateCommandOptionDefinitions(name, positionalOptions, keyedOptions)
  return {
    properties,
    action: commanderAction,
  }
}

export const createWorkspaceCommand = <T>(def: WorkspaceCommandDef<T>): CommandDef<T & ConfigOverrideArg> => {
  const { properties, action, extraTelemetryTags } = def

  const workspaceAction: CommandDefAction<T & ConfigOverrideArg> = async args => {
    const workspace = await loadLocalWorkspace({
      path: args.workspacePath,
      configOverrides: getConfigOverrideChanges(args.input),
    })

    args.cliTelemetry.setTags({
      ...getWorkspaceTelemetryTags(workspace),
      ...extraTelemetryTags?.({ workspace, input: args.input }),
    })

    args.cliTelemetry.start()

    const result = await action({ ...args, workspace })

    if (result === CliExitCode.Success) {
      args.cliTelemetry.success()
    } else {
      args.cliTelemetry.failure()
    }
    return result
  }

  // Add common options
  const keyedOptions = [CONFIG_OVERRIDE_OPTION, ...(properties.keyedOptions ?? [])] as KeyedOption<
    T & ConfigOverrideArg
  >[]

  // We need this cast because the compiler cannot validate the generic value with a new type
  const positionalOptions = properties.positionalOptions as PositionalOption<T & ConfigOverrideArg>[] | undefined

  return createPublicCommandDef({
    properties: {
      ...properties,
      positionalOptions,
      keyedOptions,
    },
    action: workspaceAction,
  })
}

export const createCommandGroupDef = (def: CommandsGroupDef): CommandsGroupDef => def
