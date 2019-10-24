import { discover, Workspace, loadConfig } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { getConfigFromUser } from '../callbacks'
import { formatWorkspaceErrors } from '../formatter'

export const command = (
  workspaceDir: string,
  { stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
    const config = await loadConfig(workspaceDir)
    const workspace = await Workspace.load(config)
    if (workspace.hasErrors()) {
      stderr.write(formatWorkspaceErrors(workspace.errors))
    } else {
      await discover(workspace, getConfigFromUser)
    }
  },
})

type DiscoverArgs = {
  'workspace-dir': string
}
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs>

const discoverBuilder = createCommandBuilder({
  options: {
    command: 'discover',
    aliases: ['dis'],
    description: 'Update blueprints and state in workspace directory',
    keyed: {
      'workspace-dir': {
        alias: ['d'],
        describe: 'Path to the workspace directory',
        string: true,
        default: '.',
        requiresArg: true,
      },
    },
  },

  async build(input: DiscoverParsedCliInput, output: CliOutput) {
    return command(input.args['workspace-dir'], output)
  },
})

export default discoverBuilder
