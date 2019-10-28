import { streams } from '@salto/lowerdash'
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
  start(text: string): Spinner
  succeed(text: string): Spinner
  fail(text: string): Spinner
}

export interface SpinnerOptions {
  indent?: number
  hideCursor?: boolean
  color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray'
  prefixText?: string
}

export type SpinnerCreator = (options: SpinnerOptions) => Spinner

export interface CliOutput {
  stdout: WriteStream
  stderr: WriteStream

  // TODO: Also belong here:
  // fs abstractions
}

export interface CliInput {
  args: string[]
  stdin: ReadStream

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
