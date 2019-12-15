import { preview } from 'salto'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput, SpinnerCreator, CliExitCode,
} from '../types'
import { formatExecutionPlan } from '../formatter'
import { loadWorkspace } from '../workspace'
import Prompts from '../prompts'
import { validateAndDefaultServices } from '../services'

export const command = (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  spinnerCreator: SpinnerCreator,
  inputServices: string[]
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workspaceDir,
      { stdout, stderr }, spinnerCreator)
    if (errored) {
      return CliExitCode.AppError
    }

    const commandServices = validateAndDefaultServices(workspace.config.services, inputServices)

    const spinner = spinnerCreator(Prompts.PREVIEW_STARTED, {})
    try {
      const workspacePlan = await preview(workspace, commandServices)
      spinner.succeed(Prompts.PREVIEW_FINISHED)
      stdout.write(formatExecutionPlan(workspacePlan))
      return CliExitCode.Success
    } catch (e) {
      spinner.fail(Prompts.PREVIEW_FAILED)
      throw e
    }
  },
})

type PreviewArgs = {
  services: string[]
}
type PreviewParsedCliInput = ParsedCliInput<PreviewArgs>

const previewBuilder = createCommandBuilder({
  options: {
    command: 'preview',
    description: 'Shows Salto\'s execution plan next time deploy is run',
    keyed: {
      'workspace-dir': {
        alias: 'w',
        describe: 'Path to the workspace directory',
        string: true,
        default: '.',
      },
      services: {
        alias: 's',
        describe: 'Specific services to perform this action for (default=all)',
        type: 'array',
        string: true,
      },
    },
  },

  async build(input: PreviewParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command('.', output, spinnerCreator, input.args.services)
  },
})

export default previewBuilder
