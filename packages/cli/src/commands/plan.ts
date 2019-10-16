import { plan, Workspace, loadConfig } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { createPlanOutput } from '../formatter'

export const command = (
  workspaceDir: string,
  { stdout }: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
    const config = await loadConfig(workspaceDir)
    const workspace: Workspace = await Workspace.load(config)
    // TODO: inline commands.plan here
    stdout.write(createPlanOutput(await plan(workspace)))
  },
})

type PlanArgs = {
  'workspace-dir': string
}
type PlanParsedCliInput = ParsedCliInput<PlanArgs>

const builder = createCommandBuilder({
  options: {
    command: 'plan',
    aliases: ['p'],
    description: 'Shows changes to be applied to the target services at the next run of the *apply* command',
    keyed: {
      'workspace-dir': {
        alias: 'w',
        describe: 'Path to the workspace directory',
        string: true,
        default: '.',
      },
    },
  },

  async build(input: PlanParsedCliInput, output: CliOutput) {
    return command(input.args['workspace-dir'], output)
  },
})

export default builder
