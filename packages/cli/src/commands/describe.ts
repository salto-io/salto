import { describeElement } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { formatSearchResults } from '../formatter'
import { loadWorkspace } from '../workspace'

export const command = (
  workspaceDir: string,
  words: string[],
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workspaceDir, stderr)
    if (errored) {
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
