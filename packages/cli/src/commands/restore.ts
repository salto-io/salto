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
import { Telemetry, restore, StepEmitter, RestoreProgressEvents } from '@salto-io/core'
import { logger } from '@salto-io/logging'
import { EOL } from 'os'
import { EventEmitter } from 'pietile-eventemitter'
import _ from 'lodash'
import { ServicesArgs, servicesFilter } from '../filters/services'
import { EnvironmentArgs } from './env'
import { ParsedCliInput, CliOutput, SpinnerCreator, CliExitCode, CliCommand } from '../types'
import { createCommandBuilder } from '../command_builder'
import { environmentFilter } from '../filters/env'
import { getCliTelemetry } from '../telemetry'
import { loadWorkspace, getWorkspaceTelemetryTags, applyChangesToWorkspace } from '../workspace/workspace'
import { getApprovedChanges } from '../callbacks'
import Prompts from '../prompts'
import { formatChangesSummary, formatDetailedChanges, formatRestoreFinish, formatInvalidFilters } from '../formatter'
import { progressOutputer, outputLine } from '../outputer'

const log = logger(module)

type RestoreArgs = {
    force: boolean
    interactive: boolean
    dryRun: boolean
    printDetails: boolean
    isolated: boolean
    filters: string[]
  } & ServicesArgs & EnvironmentArgs

type RestoreParsedCliInput = ParsedCliInput<RestoreArgs>

// TODO - move to formatter.ts


const createRegexFilters = (
  inputFilters: string[]
): {filters: RegExp[]; invalidFilters: string[]} => {
  const [validFilters, invalidFilters] = _.partition(inputFilters, filter => {
    try {
      return new RegExp(filter)
    } catch (e) {
      return false
    }
  })
  const filters = validFilters.map(filter => new RegExp(filter))
  return { filters, invalidFilters }
}


export const command = (
  workspaceDir: string,
  force: boolean,
  interactive: boolean,
  dryRun: boolean,
  printDetails: boolean,
  telemetry: Telemetry,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  inputIsolated: boolean,
  shouldCalcTotalSize: boolean,
  inputServices?: string[],
  inputEnvironment?: string,
  inputFilters: string[] = []
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running restore command on '${workspaceDir}' [force=${force}, interactive=${
      interactive}, dryRun=${dryRun}, printDetails=${printDetails}, isolated=${inputIsolated}], environment=${inputEnvironment}, services=${inputServices}`)
    const restoreProgress = new EventEmitter<RestoreProgressEvents>()
    restoreProgress.on('diffWillBeCalculated', progressOutputer(
      Prompts.RESTORE_CALC_DIFF_START,
      Prompts.RESTORE_CALC_DIFF_FINISH,
      Prompts.RESTORE_CALC_DIFF_FAIL,
      output
    ))
    restoreProgress.on('diffWasCalculated', detailedChanges => {
      outputLine(EOL, output)
      if (detailedChanges.length > 0) {
        outputLine(formatDetailedChanges([detailedChanges], printDetails), output)
      } else {
        outputLine('No changes', output)
      }
      outputLine(EOL, output)
    })
    restoreProgress.on('workspaceWillBeUpdated', (progress: StepEmitter, changes: number, approved: number) =>
      progressOutputer(
        formatChangesSummary(changes, approved),
        Prompts.RESTORE_UPDATE_WORKSPACE_SUCCESS,
        Prompts.RESTORE_UPDATE_WORKSPACE_FAIL,
        output
      )(progress))
    const { filters, invalidFilters } = createRegexFilters(inputFilters)
    if (!_.isEmpty(invalidFilters)) {
      output.stderr.write(formatInvalidFilters(invalidFilters))
      return CliExitCode.UserInputError
    }
    const cliTelemetry = getCliTelemetry(telemetry, 'restore')
    const { workspace, errored } = await loadWorkspace(workspaceDir, output,
      { force, printStateRecency: true, spinnerCreator, sessionEnv: inputEnvironment })
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }
    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.start(workspaceTags)
    const changes = await restore(workspace, inputServices, filters, restoreProgress)
    if (dryRun) {
      cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    }
    const updatingWsSucceeded = await applyChangesToWorkspace({
      changes,
      workspace,
      cliTelemetry,
      workspaceTags,
      interactive,
      force,
      shouldCalcTotalSize,
      applyProgress: restoreProgress,
      output,
      isIsolated: inputIsolated,
      approveChangesCallback: getApprovedChanges,
    })
    if (updatingWsSucceeded) {
      outputLine(formatRestoreFinish(), output)
      cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    }
    cliTelemetry.failure(workspaceTags)
    return CliExitCode.AppError
  },
})

const restoreBuilder = createCommandBuilder({
  options: {
    command: 'restore [filters..]',
    description: 'Syncs this workspace with the current local state',
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
      // will also be available as dryRun because of camel-case-expansion
      'dry-run': {
        alias: ['d'],
        describe: 'Preview the restore plan without making changes',
        boolean: true,
        default: false,
        demandOption: false,
      },
      // will also be available as printDetails because of camel-case-expansion
      'print-details': {
        alias: ['p'],
        describe: 'Print detailed changes including values',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [servicesFilter, environmentFilter],

  async build(input: RestoreParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command(
      '.',
      input.args.force,
      input.args.interactive,
      input.args.dryRun,
      input.args.printDetails,
      input.telemetry,
      output,
      spinnerCreator,
      input.args.isolated,
      input.config.shouldCalcTotalSize,
      input.args.services,
      input.args.env,
      input.args.filters
    )
  },
})

export default restoreBuilder
