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
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { convertToIDSelectors } from '../convertors'
import { servicesFilter } from '../filters/services'
import { EnvironmentArgs } from './env'
import { ParsedCliInput, CliOutput, SpinnerCreator, CliExitCode, CliCommand, CliTelemetry } from '../types'
import { createCommandBuilder } from '../command_builder'
import { environmentFilter } from '../filters/env'
import { getCliTelemetry } from '../telemetry'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import { formatStepStart, formatStepFailed, formatInvalidID as formatInvalidIDSelectors, formatStepCompleted } from '../formatter'
import { outputLine } from '../outputer'

const log = logger(module)

type PromoteArgs = {
    force: boolean
    selectors: string[]
  } & EnvironmentArgs

type PromoteParsedCliInput = ParsedCliInput<PromoteArgs>

export const command = (
  workspaceDir: string,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  force: boolean,
  inputSelectors: string[],
  inputEnvironment?: string,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running promote command on '${workspaceDir}' [environment=${inputEnvironment}, inputSelectors=${inputSelectors}`)
    const { ids, invalidSelectors } = convertToIDSelectors(inputSelectors)
    if (!_.isEmpty(invalidSelectors)) {
      output.stdout.write(formatStepFailed(formatInvalidIDSelectors(invalidSelectors)))
      return CliExitCode.UserInputError
    }

    const { workspace, errored } = await loadWorkspace(
      workspaceDir,
      output,
      {
        force,
        printStateRecency: true,
        spinnerCreator,
        sessionEnv: inputEnvironment,
      }
    )
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }

    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.start(workspaceTags)
    try {
      outputLine(formatStepStart(Prompts.PROMOTE_START), output)
      await workspace.promote(ids)
      await workspace.flush()
      outputLine(formatStepCompleted(Prompts.PROMOTE_FINISHED), output)
      cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    } catch (e) {
      cliTelemetry.failure()
      outputLine(formatStepFailed(Prompts.PROMOTE_FAILED(e.message)), output)
      return CliExitCode.AppError
    }
  },
})

const promoteBuilder = createCommandBuilder({
  options: {
    command: 'promote [selectors..]',
    description: 'Promote the specific environment elements to be shared between all environments.',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Promote the elements even if the workspace is invalid.',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [servicesFilter, environmentFilter],

  async build(
    input: PromoteParsedCliInput,
    output: CliOutput,
    spinnerCreator: SpinnerCreator
  ): Promise<CliCommand> {
    return command(
      '.',
      getCliTelemetry(input.telemetry, 'promote'),
      output,
      spinnerCreator,
      input.args.force,
      input.args.selectors,
      input.args.env
    )
  },
})

export default promoteBuilder
