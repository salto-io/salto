import { plan } from 'salto'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput, SpinnerCreator, CliExitCode,
} from '../types'
import { createPlanOutput } from '../formatter'
import { loadWorkspace } from '../workspace'
import Prompts from '../prompts'

export const command = (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  spinnerCreator: SpinnerCreator
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const spinner = spinnerCreator(Prompts.PLAN_STARTED, {})
    try {
      const { workspace, errored } = await loadWorkspace(workspaceDir, stderr)
      if (errored) {
        spinner.fail(Prompts.PLAN_FAILED)
        return CliExitCode.AppError
      }
      // TODO: inline commands.plan here
      const workspacePlan = await plan(workspace)
      spinner.succeed(Prompts.PLAN_FINISHED)
      stdout.write(createPlanOutput(workspacePlan))
      return CliExitCode.Success
    } catch (error) {
      spinner.fail(Prompts.PLAN_FAILED)
      throw error
    }
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
    return command('.', output, spinnerCreator)
  },
})

export default planBuilder
