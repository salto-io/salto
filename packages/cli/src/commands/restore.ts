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
import { restore, LocalChange, Tags } from '@salto-io/core'
import { logger } from '@salto-io/logging'
import { Workspace, nacl } from '@salto-io/workspace'
import { EOL } from 'os'
import _ from 'lodash'
import { ServicesArgs, servicesFilter } from '../filters/service'
import { EnvironmentArgs } from './env'
import { ParsedCliInput, CliOutput, SpinnerCreator, CliExitCode, CliCommand, CliTelemetry } from '../types'
import { createCommandBuilder } from '../command_builder'
import { environmentFilter } from '../filters/env'
import { getCliTelemetry } from '../telemetry'
import { loadWorkspace, getWorkspaceTelemetryTags, updateWorkspace } from '../workspace/workspace'
import { getApprovedChanges } from '../callbacks'
import Prompts from '../prompts'
import { formatChangesSummary, formatDetailedChanges, formatRestoreFinish, formatInvalidFilters, formatStepStart, formatStepCompleted, formatStepFailed, header } from '../formatter'
import { outputLine, errorOutputLine } from '../outputer'
import { createRegexFilters } from '../convertors'
import { FetchModeArgs, fetchModeFilter } from '../filters/fetch_mode'

const log = logger(module)

type RestoreArgs = {
    force: boolean
    interactive: boolean
    dryRun: boolean
    detailedPlan: boolean
    listPlannedChanges: boolean
    elementSelector: string[]
  } & ServicesArgs & EnvironmentArgs & FetchModeArgs

type RestoreParsedCliInput = ParsedCliInput<RestoreArgs>


const printRestorePlan = (changes: LocalChange[], detailed: boolean, output: CliOutput): void => {
  outputLine(EOL, output)
  outputLine(header(Prompts.RESTORE_CALC_DIFF_RESULT_HEADER), output)
  if (changes.length > 0) {
    outputLine(
      formatDetailedChanges([changes.map(change => change.change)], detailed),
      output,
    )
  } else {
    outputLine('No changes', output)
  }
  outputLine(EOL, output)
}

export const command = (
  workspaceDir: string,
  {
    force,
    interactive,
    dryRun,
    detailedPlan,
    listPlannedChanges,
  }: {
    force: boolean
    interactive: boolean
    dryRun: boolean
    detailedPlan: boolean
    listPlannedChanges: boolean
  },
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  mode: nacl.RoutingMode,
  shouldCalcTotalSize: boolean,
  inputServices?: string[],
  inputEnvironment?: string,
  inputFilters: string[] = []
): CliCommand => {
  const applyLocalChangesToWorkspace = async (
    changes: LocalChange[],
    workspace: Workspace,
    workspaceTags: Tags,
  ): Promise<boolean> => {
    // If the workspace starts empty there is no point in showing a huge amount of changes
    const changesToApply = force || (await workspace.isEmpty())
      ? changes
      : await getApprovedChanges(changes, interactive)

    cliTelemetry.changesToApply(changesToApply.length, workspaceTags)
    outputLine(EOL, output)
    outputLine(
      formatStepStart(formatChangesSummary(changes.length, changesToApply.length)),
      output,
    )

    const success = await updateWorkspace({
      workspace,
      output,
      changes: changesToApply,
      mode,
      force,
    })
    if (success) {
      outputLine(formatStepCompleted(Prompts.RESTORE_UPDATE_WORKSPACE_SUCCESS), output)
      if (shouldCalcTotalSize) {
        const totalSize = await workspace.getTotalSize()
        log.debug(`Total size of the workspace is ${totalSize} bytes`)
        cliTelemetry.workspaceSize(totalSize, workspaceTags)
      }
      return true
    }
    outputLine(formatStepFailed(Prompts.RESTORE_UPDATE_WORKSPACE_FAIL), output)
    outputLine(EOL, output)
    return false
  }

  return {
    async execute(): Promise<CliExitCode> {
      log.debug(`running restore command on '${workspaceDir}' [force=${force}, interactive=${
        interactive}, dryRun=${dryRun}, detailedPlan=${detailedPlan}, listPlannedChanges=${
        listPlannedChanges}, mode=${mode}], environment=${inputEnvironment}, services=${inputServices}`)

      const { filters, invalidFilters } = createRegexFilters(inputFilters)
      if (!_.isEmpty(invalidFilters)) {
        errorOutputLine(formatInvalidFilters(invalidFilters), output)
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

      outputLine(EOL, output)
      outputLine(formatStepStart(Prompts.RESTORE_CALC_DIFF_START), output)

      const changes = await restore(workspace, inputServices, filters)
      if (listPlannedChanges || dryRun) {
        printRestorePlan(changes, detailedPlan, output)
      }

      outputLine(formatStepStart(Prompts.RESTORE_CALC_DIFF_FINISH), output)
      outputLine(EOL, output)

      if (dryRun) {
        cliTelemetry.success(workspaceTags)
        return CliExitCode.Success
      }

      const updatingWsSucceeded = await applyLocalChangesToWorkspace(
        changes,
        workspace,
        workspaceTags,
      )

      if (updatingWsSucceeded) {
        outputLine(formatRestoreFinish(), output)
        cliTelemetry.success(workspaceTags)
        return CliExitCode.Success
      }
      cliTelemetry.failure(workspaceTags)
      return CliExitCode.AppError
    },
  }
}

const restoreBuilder = createCommandBuilder({
  options: {
    command: 'restore [element-selector..]',
    description: 'Restore configuration element(s) from the state file',
    positional: {
      'element-selector': {
        description: 'Array of configuration element patterns',
      },
    },
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Accept all incoming changes',
        boolean: true,
        default: false,
        demandOption: false,
      },
      interactive: {
        alias: ['i'],
        describe: 'Interactively approve every incoming change',
        boolean: true,
        default: false,
        demandOption: false,
      },
      isolated: {
        alias: ['t'],
        describe: 'Restrict restore from modifying common configuration '
            + '(might result in changes in other env folders)',
        boolean: true,
        default: false,
        demandOption: false,
      },
      'dry-run': {
        alias: ['d'],
        describe: 'Preview the restore plan without making changes',
        boolean: true,
        default: false,
        demandOption: false,
      },
      'detailed-plan': {
        alias: ['p'],
        describe: 'Print detailed changes including values',
        boolean: true,
        default: false,
        demandOption: false,
      },
      'list-planned-changes': {
        alias: ['l'],
        describe: 'Print a summary of the planned changes',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [servicesFilter, environmentFilter, fetchModeFilter],

  async build(
    input: RestoreParsedCliInput,
    output: CliOutput,
    spinnerCreator: SpinnerCreator
  ): Promise<CliCommand> {
    return command(
      '.',
      {
        force: input.args.force,
        interactive: input.args.interactive,
        dryRun: input.args.dryRun,
        detailedPlan: input.args.detailedPlan,
        listPlannedChanges: input.args.listPlannedChanges,
      },
      getCliTelemetry(input.telemetry, 'restore'),
      output,
      spinnerCreator,
      input.args.mode,
      input.config.shouldCalcTotalSize,
      input.args.services,
      input.args.env,
      input.args.elementSelector
    )
  },
})

export default restoreBuilder
