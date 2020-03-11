/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { preview } from '@salto-io/core'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput, SpinnerCreator, CliExitCode,
} from '../types'
import { formatExecutionPlan } from '../formatter'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace'
import Prompts from '../prompts'
import { servicesFilter, ServicesArgs } from '../filters/services'
import { getCliTelemetry, CliTelemetry } from '../telemetry'

export const command = (
  workspaceDir: string,
  cliTelemetry: CliTelemetry,
  { stdout, stderr }: CliOutput,
  spinnerCreator: SpinnerCreator,
  inputServices: string[]
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workspaceDir,
      { stdout, stderr }, spinnerCreator)
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }

    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.start(workspaceTags)
    const spinner = spinnerCreator(Prompts.PREVIEW_STARTED, {})
    try {
      const workspacePlan = await preview(workspace, inputServices)
      spinner.succeed(Prompts.PREVIEW_FINISHED)
      const planWorkspaceErrors = await Promise.all(
        workspacePlan.changeErrors.map(ce => workspace.transformToWorkspaceError(ce))
      )
      const formattedPlanOutput = formatExecutionPlan(
        workspacePlan,
        planWorkspaceErrors
      )
      stdout.write(formattedPlanOutput)
      cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    } catch (e) {
      spinner.fail(Prompts.PREVIEW_FAILED)
      cliTelemetry.failure(workspaceTags)
      // not sending a stack event in here because it'll be send in the cli module (the caller)
      throw e
    }
  },
})

type PreviewArgs = {
} & ServicesArgs
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
    },
  },
  filters: [servicesFilter],

  async build(input: PreviewParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command(
      '.',
      getCliTelemetry(input.telemetry, 'preview'),
      output,
      spinnerCreator,
      input.args.services,
    )
  },
})

export default previewBuilder
