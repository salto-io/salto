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
}
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs>

const discoverBuilder = createCommandBuilder({
  options: {
    command: 'discover',
    aliases: ['dis'],
    description: 'Update blueprints and state in workspace directory',
  },

  async build(_input: DiscoverParsedCliInput, output: CliOutput) {
    return command('.', output)
  },
})

export default discoverBuilder
