import { discover, Workspace } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { getConfigFromUser } from '../callbacks'

export const command = (workspaceDir: string, additionalBlueprints: string[]): CliCommand => ({
  async execute(): Promise<void> {
    const workspace = await Workspace.load(workspaceDir, additionalBlueprints)
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
  'blueprint': string[]
}
type DiscoverParsedCliInput = ParsedCliInput<DiscoverArgs>

const builder = createCommandBuilder({
  options: {
    orderRank: 1,
    command: 'discover',
    aliases: ['dis'],
    description: 'Update blueprints and state in workspace directory',
    keyed: {
      'workspace-dir': {
        alias: ['d'],
        describe: 'Path to the workspace directory',
        string: true,
        demandOption: true,
        requiresArg: true,
      },
      blueprint: {
        alias: ['b'],
        describe: 'Additional blueprint files to load into the workspace',
        demandOption: false,
        array: true,
        string: true,
        requiresArg: true,
      },
    },
  },

  async build(input: DiscoverParsedCliInput, _output: CliOutput) {
    return command(input.args['workspace-dir'], input.args.blueprint || [])
  },
})

export default builder
