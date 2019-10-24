import { Workspace, describeElement, loadConfig } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { formatSearchResults, formatWorkspaceErrors } from '../formatter'

export const command = (
  workspaceDir: string,
  words: string[],
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
    const config = await loadConfig(workspaceDir)
    const workspace: Workspace = await Workspace.load(config)
    if (workspace.hasErrors()) {
      stderr.write(formatWorkspaceErrors(workspace.errors))
    } else {
      const searchResult = await describeElement(workspace, words)
      stdout.write(formatSearchResults(searchResult))
    }
  },
})

type DescribeArgs = {
  'workspace-dir': string
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
    keyed: {
      'workspace-dir': {
        alias: 'w',
        describe: 'Path to the workspace directory',
        demandOption: false,
        default: '.',
        string: true,
        requiresArg: true,
      },
    },
  },

  async build(input: DescribeParsedCliInput, output: CliOutput) {
    return command(input.args['workspace-dir'], input.args.words, output)
  },
})

export default describeBuilder
