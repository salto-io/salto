import { plan, Workspace, loadConfig } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { createPlanOutput, formatWorkspaceErrors } from '../formatter'

export const command = (
  workspaceDir: string,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const config = await loadConfig(workspaceDir)
    const workspace: Workspace = await Workspace.load(config)
    if (workspace.hasErrors()) {
      stderr.write(formatWorkspaceErrors(workspace.getWorkspaceErrors()))
      return CliExitCode.AppError
    }
    // TODO: inline commands.plan here
    stdout.write(createPlanOutput(await plan(workspace)))

    return CliExitCode.Success
  },
})

type PlanArgs = {
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

  async build(_input: PlanParsedCliInput, output: CliOutput) {
    return command('.', output)
  },
})

export default planBuilder
