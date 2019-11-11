import { preview } from 'salto'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput, SpinnerCreator, CliExitCode, Spinner,
} from '../types'
import { formatExecutionPlan } from '../formatter'
import { loadWorkspace } from '../workspace'
import Prompts from '../prompts'

export const command = (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  spinnerCreator: SpinnerCreator
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    let spinner: Spinner | undefined
    try {
      const { workspace, errored } = await loadWorkspace(workspaceDir, { stdout, stderr })
      if (errored) {
        return CliExitCode.AppError
      }
      // TODO: inline commands.plan here
      spinner = spinnerCreator(Prompts.PREVIEW_STARTED, {})
      const workspacePlan = await preview(workspace)
      spinner.succeed(Prompts.PREVIEW_FINISHED)
      stdout.write(formatExecutionPlan(workspacePlan))
      return CliExitCode.Success
    } catch (e) {
      if (spinner !== undefined) {
        spinner.fail(Prompts.PREVIEW_FAILED)
      }
      throw e
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
    description: 'Shows Salto\'s execution plan next time deploy is run',
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
