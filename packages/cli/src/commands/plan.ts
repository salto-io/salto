import { plan } from 'salto'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput, Spinner, SpinnerCreator, CliExitCode,
} from '../types'
import { createPlanOutput } from '../formatter'
import { loadWorkspace } from '../workspace'

export const command = (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  spinner: Spinner
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workspaceDir, stderr)
    if (errored) {
      return CliExitCode.AppError
    }
    // TODO: inline commands.plan here
    spinner.start('Calculating execution plan')
    const workspacePlan = await plan(workspace)
    spinner.succeed('Calculated execution plan!')
    stdout.write(createPlanOutput(workspacePlan))
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

  async build(_input: PlanParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    const spinner = spinnerCreator({})
    return command('.', output, spinner)
  },
})

export default planBuilder
