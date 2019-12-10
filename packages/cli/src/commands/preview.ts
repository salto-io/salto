import _ from 'lodash'
import { preview } from 'salto'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput, SpinnerCreator, CliExitCode,
} from '../types'
import { formatExecutionPlan } from '../formatter'
import { loadWorkspace } from '../workspace'
import Prompts from '../prompts'

export const command = (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  spinnerCreator: SpinnerCreator,
  services: string[]
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workspaceDir,
      { stdout, stderr }, spinnerCreator)
    if (errored) {
      return CliExitCode.AppError
    }
    const diffServices = _.difference(services, workspace.config.services || [])
    if (diffServices.length > 0) {
      throw new Error(`Not all services (${diffServices}) are set up for this workspace`)
    }

    const spinner = spinnerCreator(Prompts.PREVIEW_STARTED, {})
    try {
      const workspacePlan = await preview(workspace, services)
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
        string: true,
      },
    },
  },

  async build(input: PreviewParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command('.', output, spinnerCreator, input.args.services)
  },
})

export default previewBuilder
