import { preview } from 'salto'
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
    const spinner = spinnerCreator(Prompts.PREVIEW_STARTED, {})
    try {
      const { workspace, errored } = await loadWorkspace(workspaceDir, stderr)
      if (errored) {
        spinner.fail(Prompts.PREVIEW_FAILED)
        return CliExitCode.AppError
      }
      // TODO: inline commands.plan here
      const workspacePlan = await preview(workspace)
      spinner.succeed(Prompts.PREVIEW_FINISHED)
      stdout.write(createPlanOutput(workspacePlan))
      return CliExitCode.Success
    } catch (error) {
      spinner.fail(Prompts.PREVIEW_FAILED)
      throw error
    }
  },
})

type PreviewArgs = {
}
type PreviewParsedCliInput = ParsedCliInput<PreviewArgs>

const previewBuilder = createCommandBuilder({
  options: {
    command: 'preview',
    aliases: ['p'],
    description: 'Shows changes to be applied to the target services at the next run of the *deploy* command',
    keyed: {
      'workspace-dir': {
        alias: 'w',
        describe: 'Path to the workspace directory',
        string: true,
        default: '.',
      },
    },
  },

  async build(_input: PreviewParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command('.', output, spinnerCreator)
  },
})

export default previewBuilder
