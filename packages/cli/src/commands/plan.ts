import { plan, Workspace, loadConfig } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { createPlanOutput, formatWorkspaceErrors } from '../formatter'

export const command = (
  workspaceDir: string,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
    const config = await loadConfig(workspaceDir)
    const workspace: Workspace = await Workspace.load(config)
    if (workspace.hasErrors()) {
      stderr.write(formatWorkspaceErrors(workspace.errors))
    } else {
    // TODO: inline commands.plan here
      stdout.write(createPlanOutput(await plan(workspace)))
    }
  },
})

type PlanArgs = {
  'workspace-dir': string
}
type PlanParsedCliInput = ParsedCliInput<PlanArgs>

const planBuilder = createCommandBuilder({
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

export default planBuilder
