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

export type CommandBuilder<
  TParsedArgs = {},
  TParsedCliInput extends ParsedCliInput<TParsedArgs> = ParsedCliInput<TParsedArgs>,
> =
  // Create a CliCommand given a parsed CLI input (output of yargs parser) and output interface
  (input: TParsedCliInput, output: CliOutput) => Promise<CliCommand>

export interface KeyedArgs {
  [key: string]: yargs.Options
}

export interface ArgsFilter<
  TParsedArgsIn extends {} = {}, TAddedCliInput extends {} = {},
> {
  transformParser(parser: yargs.Argv): yargs.Argv

  transformParsedCliInput(
    input: ParsedCliInput<TParsedArgsIn>
  ): Promise<ParsedCliInput & TAddedCliInput>
}

export interface YargsModuleOpts {
  // Name of this command in the CLI, e.g., 'apply'
  // If positional arguments are included, they also need to be specified here
  // See: https://github.com/yargs/yargs/blob/master/docs/advanced.md#positional-arguments
  command: string

  // Additional or shorthand names, e.g, 'a'
  aliases?: string[]

  // Description to be shown in help
  description: string

  // Positional arguments
  positional?: [string, yargs.PositionalOptions][]

  // Keyed arguments
  keyed?: KeyedArgs
}

export interface YargsCommandBuilder<
  TParsedArgs = {},
  TParsedCliInput extends ParsedCliInput<TParsedArgs> = ParsedCliInput<TParsedArgs>,
  > {
  // Yargs CommandModule for this command
  // See https://github.com/yargs/yargs/blob/master/docs/advanced.md#providing-a-command-module
  yargsModule: Omit<yargs.CommandModule, 'handler'>

  // Defines filters to apply on the yargs options and on the parsed CLI input
  filters?: ArgsFilter[]

  // Creates the actual command
  build: CommandBuilder<TParsedArgs, TParsedCliInput>
}
