import { discover, Workspace, loadConfig } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { getConfigFromUser } from '../callbacks'

export const command = (workspaceDir: string): CliCommand => ({
  async execute(): Promise<void> {
    const config = await loadConfig(workspaceDir)
    const workspace = await Workspace.load(config)
    if (workspace.hasErrors()) {
      throw new Error(
        `Failed to load workspace, errors:\n${workspace.errors.strings().join('\n')}`
      )
    }
    await discover(workspace, getConfigFromUser)
  },
})

type DiscoverArgs = {
  'workspace-dir': string
}
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs>

const builder = createCommandBuilder({
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

  async build(input: DiscoverParsedCliInput, _output: CliOutput) {
    return command(input.args['workspace-dir'])
  },
})

export default builder
