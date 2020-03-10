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
import { streams } from '@salto-io/lowerdash'
import { Telemetry } from '@salto-io/core'
import yargs from 'yargs'

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

export interface CliInput {
  args: string[]
  stdin: ReadStream
  telemetry: Telemetry

  // TODO: Also belong here:
  // env: NodeJS.ProcessEnv
  // fs abstractions
}

// CliInput transformed after yargs did its work - args is replaced
export interface ParsedCliInput<TParsedArgs = {}> extends Omit<CliInput, 'args'> {
  args: yargs.Arguments<TParsedArgs>
}

export interface CliCommand {
  execute(): Promise<CliExitCode>
}

export type telemetryEventNames = {
  start: string
  failure: string
  success: string
  mergeErrors: string
  changes: string
  changesToApply: string
  errors: string
  failedRows: string
  actionsFailure: string
  actionsSuccess: string
}
