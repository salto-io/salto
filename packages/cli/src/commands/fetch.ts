/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { fetch as apiFetch, FetchFunc, FetchChange, FetchProgressEvents, StepEmitter, PlanItem } from '@salto-io/core'
import { Workspace, nacl, StateRecency } from '@salto-io/workspace'
import { promises } from '@salto-io/lowerdash'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import { progressOutputer, outputLine, errorOutputLine } from '../outputer'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { CliOutput, CliExitCode, CliTelemetry } from '../types'
import { formatMergeErrors, formatFatalFetchError, formatFetchHeader, formatFetchFinish, formatStateChanges, formatStateRecencies, formatAppliedChanges } from '../formatter'
import { getApprovedChanges as cliGetApprovedChanges, shouldUpdateConfig as cliShouldUpdateConfig, getChangeToAlignAction } from '../callbacks'
import { getWorkspaceTelemetryTags, updateStateOnly, applyChangesToWorkspace, isValidWorkspaceForCommand } from '../workspace/workspace'
import Prompts from '../prompts'
import { ENVIRONMENT_OPTION, EnvArg, validateAndSetEnv } from './common/env'
import { SERVICES_OPTION, ServicesArg, getAndValidateActiveServices } from './common/services'

const log = logger(module)
const { series } = promises.array

type ApproveChangesFunc = (
  changes: ReadonlyArray<FetchChange>,
) => Promise<ReadonlyArray<FetchChange>>

type ShouldUpdateConfigFunc = (
  { stdout }: CliOutput,
  introMessage: string,
  change: PlanItem
) => Promise<boolean>

export type FetchCommandArgs = {
  workspace: Workspace
  force: boolean
  mode: nacl.RoutingMode
  cliTelemetry: CliTelemetry
  output: CliOutput
  fetch: FetchFunc
  getApprovedChanges: ApproveChangesFunc
  shouldUpdateConfig: ShouldUpdateConfigFunc
  shouldCalcTotalSize: boolean
  stateOnly: boolean
  services: string[]
  regenerateSaltoIds: boolean
}

export const fetchCommand = async (
  {
    workspace, force, mode,
    getApprovedChanges, shouldUpdateConfig, services,
    cliTelemetry, output, fetch, shouldCalcTotalSize,
    stateOnly, regenerateSaltoIds,
  }: FetchCommandArgs): Promise<CliExitCode> => {
  const bindedOutputline = (text: string): void => outputLine(text, output)
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  const fetchProgress = new EventEmitter<FetchProgressEvents>()
  fetchProgress.on('adaptersDidInitialize', () => {
    bindedOutputline(formatFetchHeader())
  })

  fetchProgress.on('stateWillBeUpdated', (
    progress: StepEmitter,
    numOfChanges: number
  ) => progressOutputer(
    formatStateChanges(numOfChanges),
    () => Prompts.STATE_ONLY_UPDATE_END,
    Prompts.STATE_ONLY_UPDATE_FAILED(numOfChanges),
    output
  )(progress))

  fetchProgress.on('changesWillBeFetched', (progress: StepEmitter, adapters: string[]) => progressOutputer(
    Prompts.FETCH_GET_CHANGES_START(adapters),
    () => Prompts.FETCH_GET_CHANGES_FINISH(adapters),
    Prompts.FETCH_GET_CHANGES_FAIL,
    output
  )(progress))

  fetchProgress.on('diffWillBeCalculated', progressOutputer(
    Prompts.FETCH_CALC_DIFF_START,
    () => Prompts.FETCH_CALC_DIFF_FINISH,
    Prompts.FETCH_CALC_DIFF_FAIL,
    output
  ))
  fetchProgress.on('workspaceWillBeUpdated', (progress: StepEmitter, _changes: number, approved: number) => {
    log.debug(`Applying ${approved} semantic changes to the local workspace`)

    progressOutputer(
      Prompts.APPLYING_CHANGES,
      formatAppliedChanges,
      Prompts.FETCH_UPDATE_WORKSPACE_FAIL,
      output
    )(progress)
  })

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
  if (stateOnly && mode !== 'default') {
    throw new Error('The state only flag can only be used in default mode')
  }
  const fetchResult = await fetch(
    workspace,
    fetchProgress,
    services,
    regenerateSaltoIds,
  )
  if (fetchResult.success === false) {
    errorOutputLine(formatFatalFetchError(fetchResult.mergeErrors), output)
    return CliExitCode.AppError
  }

  // A few merge errors might have occurred,
  // but since it's fetch flow, we omitted the elements
  // and only print the merge errors
  if (!_.isEmpty(fetchResult.mergeErrors)) {
    log.debug(`fetch had ${fetchResult.mergeErrors.length} merge errors`)
    cliTelemetry.mergeErrors(fetchResult.mergeErrors.length, workspaceTags)
    errorOutputLine(formatMergeErrors(fetchResult.mergeErrors), output)
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
    return CliExitCode.Success
  }
  return CliExitCode.AppError
}

const shouldRecommendAlignMode = async (
  workspace: Workspace,
  stateRecencies: StateRecency[],
  inputServices?: ReadonlyArray<string>,
): Promise<boolean> => {
  const newlyAddedServices = stateRecencies
    .filter(recency => (
      inputServices === undefined
      || inputServices.includes(recency.serviceName)
    ))

  return (
    newlyAddedServices.every(recency => recency.status === 'Nonexistent')
    && workspace.hasElementsInServices(newlyAddedServices.map(recency => recency.serviceName))
  )
}

type FetchArgs = {
  force: boolean
  stateOnly: boolean
  mode: nacl.RoutingMode
  regenerateSaltoIds: boolean
} & ServicesArg & EnvArg

export const action: WorkspaceCommandAction<FetchArgs> = async ({
  input,
  cliTelemetry,
  config,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { force, stateOnly, services, mode, regenerateSaltoIds } = input
  const { shouldCalcTotalSize } = config
  await validateAndSetEnv(workspace, input, output)
  const activeServices = getAndValidateActiveServices(workspace, services)
  const stateRecencies = await Promise.all(
    activeServices.map(service => workspace.getStateRecency(service))
  )
  // Print state recencies
  outputLine(formatStateRecencies(stateRecencies), output)

  const validWorkspace = await isValidWorkspaceForCommand(
    { workspace, cliOutput: output, spinnerCreator, force }
  )
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  let useAlignMode = false
  if (!force && mode !== 'align' && await shouldRecommendAlignMode(workspace, stateRecencies, activeServices)) {
    const userChoice = await getChangeToAlignAction(mode, output)
    if (userChoice === 'cancel operation') {
      log.info('Canceling operation based on user input')
      return CliExitCode.UserInputError
    }
    if (userChoice === 'yes') {
      log.info(`Changing fetch mode from '${mode}' to 'align' based on user input`)
      useAlignMode = true
    }
    log.info('Not changing fetch mode based on user input')
  }

  return fetchCommand({
    workspace,
    force,
    cliTelemetry,
    output,
    fetch: apiFetch,
    getApprovedChanges: cliGetApprovedChanges,
    shouldUpdateConfig: cliShouldUpdateConfig,
    services: activeServices,
    mode: useAlignMode ? 'align' : mode,
    shouldCalcTotalSize,
    stateOnly,
    regenerateSaltoIds,
  })
}

const fetchDef = createWorkspaceCommand({
  properties: {
    name: 'fetch',
    description: 'Update the workspace configuration elements from the upstream services',
    keyedOptions: [
      {
        name: 'force',
        alias: 'f',
        required: false,
        description: 'Do not warn on conflicts with local changes',
        type: 'boolean',
      },
      {
        name: 'stateOnly',
        alias: 'st',
        required: false,
        description: 'Update just the state file and not the NaCLs',
        type: 'boolean',
      },
      SERVICES_OPTION,
      ENVIRONMENT_OPTION,
      {
        name: 'mode',
        alias: 'm',
        required: false,
        description: 'Choose a fetch mode. Options - [default, align, override, isolated]',
        type: 'string',
        choices: ['default', 'align', 'override', 'isolated'],
        default: 'default',
      },
      {
        name: 'regenerateSaltoIds',
        alias: 'r',
        required: false,
        description: 'Regenerate configuration elements Salto IDs based on the current settings and fetch results',
        type: 'boolean',
      },
    ],
  },
  action,
})

export default fetchDef
