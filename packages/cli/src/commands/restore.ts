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
import { restore, RestoreChange, Tags } from '@salto-io/core'
import { logger } from '@salto-io/logging'
import { Workspace } from '@salto-io/workspace'
import { EOL } from 'os'
import _ from 'lodash'
import { ServicesArgs, servicesFilter } from '../filters/services'
import { EnvironmentArgs } from './env'
import { ParsedCliInput, CliOutput, SpinnerCreator, CliExitCode, CliCommand, CliTelemetry } from '../types'
import { createCommandBuilder } from '../command_builder'
import { environmentFilter } from '../filters/env'
import { getCliTelemetry } from '../telemetry'
import { loadWorkspace, getWorkspaceTelemetryTags, updateWorkspace } from '../workspace/workspace'
import { getApprovedChanges } from '../callbacks'
import Prompts from '../prompts'
import { formatChangesSummary, formatDetailedChanges, formatRestoreFinish, formatInvalidFilters, formatStepStart, formatStepCompleted, formatStepFailed, header } from '../formatter'
import { outputLine } from '../outputer'

const log = logger(module)

type RestoreArgs = {
    force: boolean
    interactive: boolean
    dryRun: boolean
    detailedPlan: boolean
    listPlannedChanges: boolean
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

export class RestoreCommand implements CliCommand {
  readonly output: CliOutput
  private cliTelemetry: CliTelemetry
  inputFilters: string[]
  force: boolean
  interactive: boolean
  dryRun: boolean
  detailedPlan: boolean
  listPlannedChanges: boolean

  constructor(
    private readonly workspaceDir: string,
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
    private readonly spinnerCreator: SpinnerCreator,
    readonly inputIsolated: boolean,
    readonly shouldCalcTotalSize: boolean,
    readonly inputServices?: string[],
    readonly inputEnv?: string,
    inputFilters: string[] = []
  ) {
    this.output = output
    this.cliTelemetry = cliTelemetry
    this.inputServices = inputServices
    this.inputEnv = inputEnv
    this.inputFilters = inputFilters
    this.force = force
    this.interactive = interactive
    this.dryRun = dryRun
    this.detailedPlan = detailedPlan
    // dry-run always prints plan
    this.listPlannedChanges = listPlannedChanges || dryRun
  }

  async computeRestorePlan(workspace: Workspace, filters: RegExp[]): Promise<RestoreChange[]> {
    outputLine(EOL, this.output)
    outputLine(formatStepStart(Prompts.RESTORE_CALC_DIFF_START), this.output)

    const changes = await restore(workspace, this.inputServices, filters)

    const detailedChanges = changes.map(change => change.change)
    if (this.listPlannedChanges) {
      outputLine(EOL, this.output)
      outputLine(header(Prompts.RESTORE_CALC_DIFF_RESULT_HEADER), this.output)
      if (detailedChanges.length > 0) {
        outputLine(formatDetailedChanges([detailedChanges], this.detailedPlan), this.output)
      } else {
        outputLine('No changes', this.output)
      }
      outputLine(EOL, this.output)
    }
    outputLine(formatStepStart(Prompts.RESTORE_CALC_DIFF_FINISH), this.output)
    outputLine(EOL, this.output)

    return changes
  }

  async applyRestoreChangesToWorkspace(
    changes: RestoreChange[],
    workspace: Workspace,
    workspaceTags: Tags,
  ): Promise<boolean> {
    // If the workspace starts empty there is no point in showing a huge amount of changes
    const changesToApply = this.force || (await workspace.isEmpty())
      ? changes
      : await getApprovedChanges(changes, this.interactive)

    this.cliTelemetry.changesToApply(changesToApply.length, workspaceTags)
    outputLine(EOL, this.output)
    outputLine(
      formatStepStart(formatChangesSummary(changes.length, changesToApply.length)),
      this.output,
    )

    const success = await updateWorkspace(
      workspace,
      this.output,
      changesToApply,
      this.inputIsolated,
    )
    if (success) {
      outputLine(formatStepCompleted(Prompts.RESTORE_UPDATE_WORKSPACE_SUCCESS), this.output)
      if (this.shouldCalcTotalSize) {
        const totalSize = await workspace.getTotalSize()
        log.debug(`Total size of the workspace is ${totalSize} bytes`)
        this.cliTelemetry.workspaceSize(totalSize, workspaceTags)
      }
      return true
    }
    outputLine(formatStepFailed(Prompts.RESTORE_UPDATE_WORKSPACE_FAIL), this.output)
    outputLine(EOL, this.output)
    return false
  }

  async execute(): Promise<CliExitCode> {
    log.debug(`running restore command on '${this.workspaceDir}' [force=${this.force}, interactive=${
      this.interactive}, dryRun=${this.dryRun}, detailedPlan=${this.detailedPlan}, listPlannedChanges=${
      this.listPlannedChanges}, isolated=${this.inputIsolated}], environment=${this.inputEnv}, services=${this.inputServices}`)

    const { filters, invalidFilters } = createRegexFilters(this.inputFilters)
    if (!_.isEmpty(invalidFilters)) {
      this.output.stderr.write(formatInvalidFilters(invalidFilters))
      return CliExitCode.UserInputError
    }

    const { workspace, errored } = await loadWorkspace(
      this.workspaceDir,
      this.output,
      {
        force: this.force,
        printStateRecency: true,
        spinnerCreator: this.spinnerCreator,
        sessionEnv: this.inputEnv,
      }
    )
    if (errored) {
      this.cliTelemetry.failure()
      return CliExitCode.AppError
    }

    const workspaceTags = await getWorkspaceTelemetryTags(workspace)

    this.cliTelemetry.start(workspaceTags)

    const changes = await this.computeRestorePlan(workspace, filters)

    if (this.dryRun) {
      this.cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    }

    const updatingWsSucceeded = await this.applyRestoreChangesToWorkspace(
      changes,
      workspace,
      workspaceTags,
    )

    if (updatingWsSucceeded) {
      outputLine(formatRestoreFinish(), this.output)
      this.cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    }
    this.cliTelemetry.failure(workspaceTags)
    return CliExitCode.AppError
  }
}

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
        describe: 'Interactively approve incoming changes (use `a` on first prompt to approve all at once)',
        boolean: true,
        default: true,
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

  filters: [servicesFilter, environmentFilter],

  async build(
    input: RestoreParsedCliInput,
    output: CliOutput,
    spinnerCreator: SpinnerCreator
  ): Promise<CliCommand> {
    return new RestoreCommand(
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
      input.args.isolated,
      input.config.shouldCalcTotalSize,
      input.args.services,
      input.args.env,
      input.args.filters
    )
  },
})

export default restoreBuilder
