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
import { ParsedCliInput, CliOutput, SpinnerCreator, CliExitCode, CliCommand, CliTelemetry } from '../types'
import { createCommandBuilder } from '../command_builder'
import { environmentFilter } from '../filters/env'
import { getCliTelemetry } from '../telemetry'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import { formatStepStart, formatStepFailed, formatInvalidID, formatStepCompleted } from '../formatter'
import { outputLine } from '../outputer'

const log = logger(module)

export const command = (
  workspaceDir: string,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  force: boolean,
  inputSelectors: string[],
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running demote command on '${workspaceDir}', inputSelectors=${inputSelectors}`)
    const { ids, invalidSelectors } = convertToIDSelectors(inputSelectors)
    if (!_.isEmpty(invalidSelectors)) {
      output.stdout.write(formatStepFailed(formatInvalidID(invalidSelectors)))
      return CliExitCode.UserInputError
    }

    const { workspace, errored } = await loadWorkspace(
      workspaceDir,
      output,
      {
        force,
        printStateRecency: true,
        spinnerCreator,
      }
    )
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }

    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.start(workspaceTags)
    try {
      outputLine(formatStepStart(Prompts.DEMOTE_START), output)
      await workspace.demote(ids)
      await workspace.flush()
      outputLine(formatStepCompleted(Prompts.DEMOTE_FINISHED), output)
      cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    } catch (e) {
      cliTelemetry.failure()
      outputLine(formatStepFailed(Prompts.DEMOTE_FAILED(e.message)), output)
      return CliExitCode.AppError
    }
  },
})

type DemoteArgs = {
  force: boolean
  selectors: string[]
}

type DemoteParsedCliInput = ParsedCliInput<DemoteArgs>

const demoteBuilder = createCommandBuilder({
  options: {
    command: 'demote [selectors..]',
    description: 'Demote the selected elements to a not be shared between environments status.',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Demote the elements even if the workspace is invalid.',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [servicesFilter, environmentFilter],

  async build(
    input: DemoteParsedCliInput,
    output: CliOutput,
    spinnerCreator: SpinnerCreator
  ): Promise<CliCommand> {
    return command(
      '.',
      getCliTelemetry(input.telemetry, 'demote'),
      output,
      spinnerCreator,
      input.args.force,
      input.args.selectors,
    )
  },
})

export default demoteBuilder
