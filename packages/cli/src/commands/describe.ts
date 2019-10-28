import { Workspace, describeElement, loadConfig } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { formatSearchResults, formatWorkspaceErrors } from '../formatter'

export const command = (
  workspaceDir: string,
  words: string[],
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const config = await loadConfig(workspaceDir)
    const workspace: Workspace = await Workspace.load(config)
    if (workspace.hasErrors()) {
      stderr.write(formatWorkspaceErrors(workspace.getWorkspaceErrors()))
      return CliExitCode.AppError
    }
    const searchResult = await describeElement(workspace, words)
    stdout.write(formatSearchResults(searchResult))

    return CliExitCode.Success
  },
})

type DescribeArgs = {
  'words': string[]
}

type DescribeParsedCliInput = ParsedCliInput<DescribeArgs>

const describeBuilder = createCommandBuilder({
  options: {
    command: 'describe <words...>',
    aliases: ['desc'],
    description: 'Shows all available types and attributes for the adapters of the related services',
    positional: {
      words: {
        type: 'string',
        description: 'Words to search',
        default: undefined, // Prevent "default: []" in the help
      },
    },
  },

  async build(input: DescribeParsedCliInput, output: CliOutput) {
    return command('.', input.args.words, output)
  },
})

export default describeBuilder
