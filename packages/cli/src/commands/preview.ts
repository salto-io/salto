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
import { environmentFilter } from '../filters/env'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput,
  SpinnerCreator, CliExitCode, CliTelemetry,
} from '../types'
import { formatExecutionPlan } from '../formatter'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import { servicesFilter, ServicesArgs } from '../filters/services'
import { getCliTelemetry } from '../telemetry'

export const command = (
  workspaceDir: string,
  cliTelemetry: CliTelemetry,
  { stdout, stderr }: CliOutput,
  spinnerCreator: SpinnerCreator,
  inputServices: string[],
  force = false,
  inputEnvironment?: string,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workspaceDir,
      { stdout, stderr },
      { force,
        printStateRecency: true,
        recommendStateRecency: true,
        spinnerCreator,
        sessionEnv: inputEnvironment })
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
  force: boolean
} & ServicesArgs
type PreviewParsedCliInput = ParsedCliInput<PreviewArgs>

const previewBuilder = createCommandBuilder({
  options: {
    command: 'preview',
    description: 'Shows Salto\'s execution plan next time deploy is run',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Do not ask for approval if there are warnings in the workspace',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },
  filters: [servicesFilter, environmentFilter],

  async build(input: PreviewParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command(
      '.',
      getCliTelemetry(input.telemetry, 'preview'),
      output,
      spinnerCreator,
      input.args.services,
      input.args.force,
      input.args.env,
    )
  },
})

export default previewBuilder
