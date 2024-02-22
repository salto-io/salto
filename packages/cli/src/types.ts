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
import { streams, types } from '@salto-io/lowerdash'
import { Telemetry, Tags, CommandConfig } from '@salto-io/core'

export type WriteStream = streams.MaybeTty & {
  write(s: string): void
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReadStream {
  // TODO
}

export enum CliExitCode {
  Success = 0,
  UserInputError = 1,
  AppError = 2,
}

export class CliError extends Error {
  // The constructor of CliError does not have message as a param becuase
  // the message would not written to stderr at any time in the flow
  // When using it handle the writing yourself
  constructor(readonly exitCode: CliExitCode) {
    super('')
  }
}

export interface Spinner {
  succeed(text: string): void
  fail(text: string): void
}

export interface SpinnerOptions {
  indent?: number
  hideCursor?: boolean
  color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray'
  prefixText?: string
}

export type SpinnerCreator = (startText: string, options: SpinnerOptions) => Spinner

export interface CliOutput {
  stdout: WriteStream
  stderr: WriteStream

  // TODO: Also belong here:
  // fs abstractions
}

export type CliArgs = {
  telemetry: Telemetry
  config: CommandConfig
  output: CliOutput
  workspacePath: string
  spinnerCreator: SpinnerCreator
}

export interface CliInput {
  args: string[]
  telemetry: Telemetry
  config: CommandConfig

  // TODO: Also belong here:
  // env: NodeJS.ProcessEnv
  // fs abstractions
}

export type TelemetryEventNames = {
  start: string
  failure: string
  success: string
  mergeErrors: string
  changes: string
  changesToApply: string
  errors: string
  actionsFailure: string
  actionsSuccess: string
  workspaceSize: string
}

export type CliTelemetry = {
  setTags(tags: Tags): void
  start(): void
  failure(): void
  success(): void
  mergeErrors(n: number): void
  changes(n: number): void
  changesToApply(n: number): void
  errors(n: number): void
  actionsSuccess(n: number): void
  actionsFailure(n: number): void
  workspaceSize(n: number): void
  stacktrace(err: Error): void
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

export type PositionalOption<T, Name = PossiblePositionalArgs<T>> =
  Name extends PossiblePositionalArgs<T>
    ? {
        name: Name & string
        required: boolean
        description?: string
        type: Exclude<GetTypeEnumValue<T[Name]>, 'boolean'>
        default?: GetOptionsDefaultType<T[Name]> & (string | boolean)
        choices?: ChoicesType<T[Name]>
      }
    : never

export type KeyedOption<T, Name extends keyof T = keyof T> = Name extends keyof T
  ? {
      name: Name & string
      required?: boolean
      description?: string
      alias?: string
      type: GetTypeEnumValue<T[Name]>
      default?: GetOptionsDefaultType<T[Name]> & (string | boolean)
      choices?: ChoicesType<T[Name]>
    }
  : never
