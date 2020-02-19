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
import { loadWorkspace } from '../workspace'
import Prompts from '../prompts'
import { servicesFilter, ServicesArgs } from '../filters/services'
import { logger } from '@salto-io/logging'
import { versionString } from '../version'

const log = logger(module)

export const command = (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  spinnerCreator: SpinnerCreator,
  inputServices: string[]
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.info(`Version: ${versionString}`)
    const { workspace, errored } = await loadWorkspace(workspaceDir,
      { stdout, stderr }, spinnerCreator)
    if (errored) {
      return CliExitCode.AppError
    }

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
      return CliExitCode.Success
    } catch (e) {
      spinner.fail(Prompts.PREVIEW_FAILED)
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
    return command('.', output, spinnerCreator, input.args.services)
  },
})

export default previewBuilder
