import yargs from 'yargs'

export interface WriteStream {
  write(s: string): void
  hasColors(): boolean
  isTTY: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReadStream {
  // TODO
}

export type CliExitCode = 0 | 1 | 2

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
  execute(): Promise<void>
}
