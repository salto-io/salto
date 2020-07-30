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
import { ElemID } from '@salto-io/adapter-api'
import _ from 'lodash'
import { servicesFilter } from '../filters/services'
import { EnvironmentArgs } from './env'
import { ParsedCliInput, CliOutput, SpinnerCreator, CliExitCode, CliCommand, CliTelemetry } from '../types'
import { createCommandBuilder } from '../command_builder'
import { environmentFilter } from '../filters/env'
import { getCliTelemetry } from '../telemetry'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import { formatStepStart, formatStepFailed, formatInvalidID } from '../formatter'
import { outputLine } from '../outputer'

const log = logger(module)

type TrackArgs = {
    force: boolean
    selectors: string[]
  } & EnvironmentArgs

type TrackParsedCliInput = ParsedCliInput<TrackArgs>

// TODO - move to formatter.ts

const createIDsToTack = (
  selectors: string[]
): {ids: ElemID[]; invalidIds: string[]} => {
  const [validIds, invalidIds] = _.partition(selectors, selector => {
    try {
      return ElemID.fromFullName(selector)
    } catch (e) {
      return false
    }
  })
  const ids = validIds.map(id => ElemID.fromFullName(id))
  return { ids, invalidIds }
}

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
    log.debug(`running track command on '${workspaceDir}' [environment=${inputEnvironment}, inputSelectors=${inputSelectors}`)
    const { ids, invalidIds } = createIDsToTack(inputSelectors)
    if (!_.isEmpty(invalidIds)) {
      output.stderr.write(formatInvalidID(invalidIds))
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
      outputLine(formatStepStart(Prompts.TRACK_CALC_CHANGES_START), output)
      await workspace.track(ids)
      outputLine(formatStepStart(Prompts.TRACK_CALC_CHANGES_FINISH), output)
    } catch (e) {
      cliTelemetry.failure()
      outputLine(formatStepFailed(Prompts.TRACK_CALC_CHANGES_FAILED(e.message)), output)
      return CliExitCode.AppError
    }
    try {
      outputLine(formatStepStart(Prompts.TRACK_FLUSH_WORKSPACE_START), output)
      await workspace.flush()
      outputLine(formatStepStart(Prompts.TRACK_FLUSH_WORKSPACE_FINISH), output)
      cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    } catch (e) {
      cliTelemetry.failure()
      outputLine(formatStepFailed(Prompts.TRACK_FLUSH_WORKSPACE_FAILED(e.message)), output)
      return CliExitCode.AppError
    }
  },
})

const trackeBuilder = createCommandBuilder({
  options: {
    command: 'track [selectors..]',
    description: 'Move the selected elements to the common folder - sharing them between all environments',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Move the elements even if the workspace is invalid.',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [servicesFilter, environmentFilter],

  async build(
    input: TrackParsedCliInput,
    output: CliOutput,
    spinnerCreator: SpinnerCreator
  ): Promise<CliCommand> {
    return command(
      '.',
      getCliTelemetry(input.telemetry, 'track'),
      output,
      spinnerCreator,
      input.args.force,
      input.args.selectors,
      input.args.env
    )
  },
})

export default trackeBuilder
