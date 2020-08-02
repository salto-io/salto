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
import _ from 'lodash'
import wu from 'wu'
import { getChangeElement, isInstanceElement } from '@salto-io/adapter-api'
import {
  fetch as apiFetch,
  FetchFunc,
  FetchChange,
  FetchProgressEvents,
  StepEmitter,
  Telemetry,
  PlanItem,
} from '@salto-io/core'
import { Workspace, nacl } from '@salto-io/workspace'
import { promises } from '@salto-io/lowerdash'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import { progressOutputer, outputLine } from '../outputer'
import { environmentFilter } from '../filters/env'
import { createCommandBuilder } from '../command_builder'
import {
  ParsedCliInput, CliCommand, CliOutput,
  CliExitCode, SpinnerCreator, CliTelemetry,
} from '../types'
import {
  formatChangesSummary, formatMergeErrors, formatFatalFetchError, formatFetchHeader,
  formatFetchFinish, formatStateChanges,
} from '../formatter'
import { getApprovedChanges as cliGetApprovedChanges,
  shouldUpdateConfig as cliShouldUpdateConfig } from '../callbacks'
import {
  loadWorkspace, getWorkspaceTelemetryTags, updateStateOnly, applyChangesToWorkspace,
} from '../workspace/workspace'
import Prompts from '../prompts'
import { servicesFilter, ServicesArgs } from '../filters/services'
import { getCliTelemetry } from '../telemetry'
import { EnvironmentArgs } from './env'

const log = logger(module)
const { series } = promises.array

type ApproveChangesFunc = (
  changes: ReadonlyArray<FetchChange>,
  interactive: boolean
) => Promise<ReadonlyArray<FetchChange>>

type ShouldUpdateConfigFunc = (
  { stdout }: CliOutput,
  introMessage: string,
  change: PlanItem
) => Promise<boolean>

export type FetchCommandArgs = {
  workspace: Workspace
  force: boolean
  interactive: boolean
  inputIsolated: boolean
  cliTelemetry: CliTelemetry
  output: CliOutput
  fetch: FetchFunc
  getApprovedChanges: ApproveChangesFunc
  shouldUpdateConfig: ShouldUpdateConfigFunc
  shouldCalcTotalSize: boolean
  stateOnly: boolean
  inputServices?: string[]
  inputAlign: boolean
  inputOveride: boolean
}

const getUpdateMode = (
  inputIsolated: boolean,
  inputOveride: boolean,
  inputAlign: boolean
): nacl.RoutingMode => {
  if ([inputIsolated, inputOveride, inputAlign].filter(i => i).length > 1) {
    throw new Error('Can only provide one fetch mode flag.')
  }
  if (inputIsolated) {
    return 'isolated'
  }
  if (inputOveride) {
    return 'overide'
  }
  if (inputAlign) {
    return 'align'
  }
  return 'default'
}

export const fetchCommand = async (
  {
    workspace, force, interactive, inputIsolated = false,
    getApprovedChanges, shouldUpdateConfig, inputServices,
    cliTelemetry, output, fetch, shouldCalcTotalSize,
    stateOnly, inputAlign, inputOveride,
  }: FetchCommandArgs): Promise<CliExitCode> => {
  const bindedOutputline = (text: string): void => outputLine(text, output)
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  const fetchProgress = new EventEmitter<FetchProgressEvents>()
  fetchProgress.on('adaptersDidInitialize', () => {
    bindedOutputline(formatFetchHeader())
  })

  fetchProgress.on('stateWillBeUpdated', (
    progress: StepEmitter,
    numOfChanges: number
  ) => progressOutputer(
    formatStateChanges(numOfChanges),
    Prompts.STATE_ONLY_UPDATE_END,
    Prompts.STATE_ONLY_UPDATE_FAILED(numOfChanges),
    output
  )(progress))

  fetchProgress.on('changesWillBeFetched', (progress: StepEmitter, adapters: string[]) => progressOutputer(
    Prompts.FETCH_GET_CHANGES_START(adapters),
    Prompts.FETCH_GET_CHANGES_FINISH(adapters),
    Prompts.FETCH_GET_CHANGES_FAIL,
    output
  )(progress))

  fetchProgress.on('diffWillBeCalculated', progressOutputer(
    Prompts.FETCH_CALC_DIFF_START,
    Prompts.FETCH_CALC_DIFF_FINISH,
    Prompts.FETCH_CALC_DIFF_FAIL,
    output
  ))
  fetchProgress.on('workspaceWillBeUpdated', (progress: StepEmitter, changes: number, approved: number) =>
    progressOutputer(
      formatChangesSummary(changes, approved),
      Prompts.FETCH_UPDATE_WORKSPACE_SUCCESS,
      Prompts.FETCH_UPDATE_WORKSPACE_FAIL,
      output
    )(progress))

  const applyChangesToState = async (allChanges: readonly FetchChange[]): Promise<boolean> => {
    const updatingStateEmitter = new StepEmitter()
    fetchProgress.emit('stateWillBeUpdated', updatingStateEmitter, allChanges.length)
    const success = await updateStateOnly(workspace, allChanges)
    if (success) {
      updatingStateEmitter.emit('completed')
      return true
    }
    updatingStateEmitter.emit('failed')
    return false
  }
  const mode = getUpdateMode(inputIsolated, inputOveride, inputAlign)
  const fetchResult = await fetch(
    workspace,
    fetchProgress,
    inputServices,
  )
  if (fetchResult.success === false) {
    output.stderr.write(formatFatalFetchError(fetchResult.mergeErrors))
    cliTelemetry.failure(workspaceTags)
    return CliExitCode.AppError
  }

  // A few merge errors might have occurred,
  // but since it's fetch flow, we omitted the elements
  // and only print the merge errors
  if (!_.isEmpty(fetchResult.mergeErrors)) {
    log.debug(`fetch had ${fetchResult.mergeErrors} merge errors`)
    cliTelemetry.mergeErrors(fetchResult.mergeErrors.length, workspaceTags)
    output.stderr.write(formatMergeErrors(fetchResult.mergeErrors))
  }

  if (!_.isUndefined(fetchResult.configChanges)) {
    const abortRequests = await series(
      wu(fetchResult.configChanges.itemsByEvalOrder()).map(planItem => async () => {
        const [change] = planItem.changes()
        const newConfig = getChangeElement(change)
        const adapterName = newConfig.elemID.adapter
        if (!isInstanceElement(newConfig)) {
          log.error('Got non instance config from adapter %s - %o', adapterName, newConfig)
          return false
        }
        const shouldWriteToConfig = force || await shouldUpdateConfig(
          output,
          fetchResult.adapterNameToConfigMessage?.[adapterName] || '',
          planItem,
        )
        if (shouldWriteToConfig) {
          await workspace.updateServiceConfig(adapterName, newConfig)
        }
        return !shouldWriteToConfig
      })
    )

    if (_.some(abortRequests)) {
      return CliExitCode.UserInputError
    }
  }

  // Unpack changes to array so we can iterate on them more than once
  const changes = [...fetchResult.changes]
  cliTelemetry.changes(changes.length, workspaceTags)

  const updatingWsSucceeded = stateOnly
    ? await applyChangesToState(changes)
    : await applyChangesToWorkspace({
      workspace,
      cliTelemetry,
      workspaceTags,
      interactive,
      force,
      shouldCalcTotalSize,
      output,
      changes,
      mode,
      approveChangesCallback: getApprovedChanges,
      applyProgress: fetchProgress,
    })
  if (updatingWsSucceeded) {
    bindedOutputline(formatFetchFinish())
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  }
  cliTelemetry.failure(workspaceTags)
  return CliExitCode.AppError
}

export const command = (
  workspaceDir: string,
  force: boolean,
  interactive: boolean,
  telemetry: Telemetry,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  inputIsolated: boolean,
  shouldCalcTotalSize: boolean,
  inputServices?: string[],
  inputEnvironment?: string,
  stateOnly = false,
  inputAlign = false,
  inputOveride = false
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running fetch command on '${workspaceDir}' [force=${force}, interactive=${
      interactive}, isolated=${inputIsolated}], environment=${inputEnvironment}, services=${inputServices}`)

    const cliTelemetry = getCliTelemetry(telemetry, 'fetch')
    const { workspace, errored } = await loadWorkspace(workspaceDir, output,
      { force, printStateRecency: true, spinnerCreator, sessionEnv: inputEnvironment })
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }

    return fetchCommand({
      workspace,
      force,
      interactive,
      cliTelemetry,
      output,
      fetch: apiFetch,
      getApprovedChanges: cliGetApprovedChanges,
      shouldUpdateConfig: cliShouldUpdateConfig,
      inputServices,
      inputIsolated,
      shouldCalcTotalSize,
      stateOnly,
      inputAlign,
      inputOveride,
    })
  },
})

type FetchArgs = {
  force: boolean
  interactive: boolean
  isolated: boolean
  stateOnly: boolean
  overide: boolean
  align: boolean
} & ServicesArgs & EnvironmentArgs
type FetchParsedCliInput = ParsedCliInput<FetchArgs>

const fetchBuilder = createCommandBuilder({
  options: {
    command: 'fetch',
    description: 'Syncs this workspace with the services\' current state',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Accept all incoming changes, even if there\'s a conflict with local changes',
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
        describe: 'Restrict fetch from modifying common configuration '
          + '(might result in changes in other env folders)',
        boolean: true,
        default: false,
        demandOption: false,
      },
      align: {
        alias: ['a'],
        describe: 'Align the current environment with the current common configuration by '
        + 'ignoring changes to the common folder',
        boolean: true,
        default: false,
        demandOption: false,
      },
      overide: {
        alias: ['o'],
        describe: 'Fetch new values to the common folder directly.',
        boolean: true,
        default: false,
        demandOption: false,
      },
      'state-only': {
        alias: ['st'],
        describe: 'Fetch remote changes to the state file without mofifying the NaCL files. ',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [servicesFilter, environmentFilter],

  async build(input: FetchParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command(
      '.',
      input.args.force,
      input.args.interactive,
      input.telemetry,
      output,
      spinnerCreator,
      input.args.isolated,
      input.config.shouldCalcTotalSize,
      input.args.services,
      input.args.env,
      input.args.stateOnly,
      input.args.align,
      input.args.overide
    )
  },
})

export default fetchBuilder
