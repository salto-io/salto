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
import { types, collections } from '@salto-io/lowerdash'
import { Telemetry, CommandConfig } from '@salto-io/core'
import { CliOutput, SpinnerCreator, CliExitCode, CliTelemetry } from './types'
import { VERBOSE_OPTION } from './commands/common/options'
import { getCliTelemetry } from './telemetry'

const { makeArray } = collections.array

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

type ActionInput<T> = {
  input: T
  telemetry: Telemetry
  config: CommandConfig
  output: CliOutput
  spinnerCreator?: SpinnerCreator
  workspacePath?: string
}

export type CommandAction<T> = (args: ActionInput<T>) => Promise<CliExitCode>

type DefActionInput<T> = {
  input: T
  output: CliOutput
  cliTelemetry: CliTelemetry
  config: CommandConfig
  spinnerCreator?: SpinnerCreator
  workspacePath?: string
}

export type CommandDefAction<T> = (args: DefActionInput<T>) => Promise<CliExitCode>

export type CommandDef<T> = {
  properties: CommandOptions<T>
  action: CommandAction<T>
}

export type CommandInnerDef<T> = {
  properties: CommandOptions<T>
  action: CommandDefAction<T>
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export const isCommand = (c: CommandOrGroupDef): c is CommandDef<any> =>
  (c !== undefined && Object.keys(c).includes('action'))

type CommandOptions<T> = BasicCommandProperties & {
  aliases?: string[]
  options?: KeyedOption<T>[]
  positionals?: PositionalOption<T>[]
}

export type OptionType = {
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
  name: Name
  required: boolean
  description?: string
  type: Exclude<GetTypeEnumValue<T[Name]>, 'boolean'>
  default?: GetOptionsDefaultType<T[Name]>
  choices?: ChoicesType<T[Name]>
} : never

export type KeyedOption<T, Name extends keyof T = keyof T> = Name extends keyof T ? {
  name: Name
  required?: boolean
  description?: string
  alias?: string
  type: GetTypeEnumValue<T[Name]>
  default?: GetOptionsDefaultType<T[Name]>
  choices?: ChoicesType<T[Name]>
} : never

export const createPublicCommandDef = <T>(def: CommandInnerDef<T>): CommandDef<T> => {
  const action = async (
    { input, telemetry, config, output, spinnerCreator, workspacePath }: ActionInput<T>,
  ): Promise<CliExitCode> => {
    // TODO: Handle sub command full names
    const cliTelemetry = getCliTelemetry(telemetry, def.properties.name)
    return def.action({
      input, cliTelemetry, config, output, spinnerCreator, workspacePath,
    })
  }
  // Add verbose to all commands
  const options = [
    ...makeArray(def.properties.options),
    VERBOSE_OPTION as KeyedOption<T>,
  ]
  return {
    properties: {
      ...def.properties,
      options,
    },
    action,
  }
}

export const createCommandGroupDef = (def: CommandsGroupDef): CommandsGroupDef => def
