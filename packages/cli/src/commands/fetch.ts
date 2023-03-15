/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { EOL } from 'os'
import _ from 'lodash'
import wu from 'wu'
import { getChangeData, isInstanceElement, AdapterOperationName, Progress, ElemID } from '@salto-io/adapter-api'
import { fetch as apiFetch, FetchFunc, FetchChange, FetchProgressEvents, StepEmitter,
  PlanItem, FetchFromWorkspaceFunc, loadLocalWorkspace, fetchFromWorkspace } from '@salto-io/core'
import { Workspace, nacl, StateRecency } from '@salto-io/workspace'
import { promises, values } from '@salto-io/lowerdash'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import { progressOutputer, outputLine, errorOutputLine } from '../outputer'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { CliOutput, CliExitCode, CliTelemetry } from '../types'
import { formatMergeErrors, formatFetchHeader, formatFetchFinish, formatStateChanges, formatStateRecencies, formatAppliedChanges, formatFetchWarnings, formatAdapterProgress } from '../formatter'
import { getApprovedChanges as cliGetApprovedChanges, shouldUpdateConfig as cliShouldUpdateConfig, getChangeToAlignAction } from '../callbacks'
import { updateStateOnly, applyChangesToWorkspace, isValidWorkspaceForCommand } from '../workspace/workspace'
import Prompts from '../prompts'
import { ENVIRONMENT_OPTION, EnvArg, validateAndSetEnv } from './common/env'
import { ACCOUNTS_OPTION, AccountsArg, getAndValidateActiveAccounts, getTagsForAccounts } from './common/accounts'
import { UpdateModeArg, UPDATE_MODE_OPTION } from './common/update_mode'

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
  accounts: string[]
  regenerateSaltoIds: boolean
}

const createFetchFromWorkspaceCommand = (
  fetchFromWorkspaceFunc: FetchFromWorkspaceFunc,
  otherWorkspacePath: string,
  env: string,
  fromState: boolean,
  elementsScope?: string[]
): FetchFunc => async (workspace, progressEmitter, accounts) => {
  let otherWorkspace: Workspace
  try {
    otherWorkspace = await loadLocalWorkspace({
      path: otherWorkspacePath,
      persistent: false,
    })
  } catch (err) {
    throw new Error(`Failed to load source workspace: ${err.message ?? err}`)
  }
  return fetchFromWorkspaceFunc({
    workspace,
    otherWorkspace,
    progressEmitter,
    accounts,
    env,
    fromState,
    elementsScope,
  })
}

export const fetchCommand = async (
  {
    workspace, force, mode,
    getApprovedChanges, shouldUpdateConfig, accounts,
    cliTelemetry, output, fetch, shouldCalcTotalSize,
    stateOnly, regenerateSaltoIds,
  }: FetchCommandArgs): Promise<CliExitCode> => {
  const bindedOutputline = (text: string): void => outputLine(text, output)
  const fetchProgress = new EventEmitter<FetchProgressEvents>()
  fetchProgress.on('adaptersDidInitialize', () => {
    bindedOutputline(formatFetchHeader())
  })

  fetchProgress.on('adapterProgress', (adapterName: string, _operationName: AdapterOperationName, progress: Progress) =>
    bindedOutputline(formatAdapterProgress(adapterName, progress.message)))

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
    accounts,
    regenerateSaltoIds,
  )

  // A few merge errors might have occurred,
  // but since it's fetch flow, we omitted the elements
  // and only print the merge errors
  if (!_.isEmpty(fetchResult.mergeErrors)) {
    log.debug(`fetch had ${fetchResult.mergeErrors.length} merge errors`)
    cliTelemetry.mergeErrors(fetchResult.mergeErrors.length)
    errorOutputLine(formatMergeErrors(fetchResult.mergeErrors), output)
  }

  if (!_.isUndefined(fetchResult.configChanges)) {
    const abortRequests = await series(
      wu(fetchResult.configChanges.itemsByEvalOrder()).map(planItem => async () => {
        const [change] = planItem.changes()
        const newConfig = getChangeData(change)
        const accountName = newConfig.elemID.adapter
        if (!isInstanceElement(newConfig)) {
          log.error('Got non instance config from adapter %s - %o', accountName, newConfig)
          return false
        }
        const shouldWriteToConfig = force || await shouldUpdateConfig(
          output,
          fetchResult.accountNameToConfigMessage?.[accountName] || '',
          planItem,
        )
        if (shouldWriteToConfig) {
          await workspace.updateAccountConfig(
            workspace.getServiceFromAccountName(accountName),
            fetchResult.updatedConfig[accountName],
            accountName
          )
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
  cliTelemetry.changes(changes.length)

  const updatingWsSucceeded = stateOnly
    ? await applyChangesToState(changes)
    : await applyChangesToWorkspace({
      workspace,
      cliTelemetry,
      force,
      shouldCalcTotalSize,
      output,
      changes,
      mode,
      approveChangesCallback: getApprovedChanges,
      applyProgress: fetchProgress,
    })
  if (!_.isEmpty(fetchResult.fetchErrors)) {
    // We currently assume all fetchErrors are warnings
    log.debug(`fetch had ${fetchResult.fetchErrors.length} warnings`)
    bindedOutputline(
      formatFetchWarnings(fetchResult.fetchErrors.map(fetchError => fetchError.message))
    )
  }
  if (updatingWsSucceeded) {
    bindedOutputline(formatFetchFinish())
    return CliExitCode.Success
  }
  return CliExitCode.AppError
}

const shouldRecommendAlignMode = async (
  workspace: Workspace,
  stateRecencies: StateRecency[],
  inputAccounts?: ReadonlyArray<string>,
): Promise<boolean> => {
  const newlyAddedAccounts = stateRecencies
    .filter(recency => (
      inputAccounts === undefined
      || inputAccounts.includes(recency.accountName ?? recency.serviceName)
    ))

  return (
    newlyAddedAccounts.every(recency => recency.status === 'Nonexistent')
    && workspace.hasElementsInAccounts(newlyAddedAccounts.map(
      recency => recency.accountName ?? recency.serviceName
    ))
  )
}

const isElementsScopeValid = (
  elementsScope: string[],
  cliOutput: CliOutput,
): boolean => {
  const invalidScopes = elementsScope.map(scope => {
    try {
      const elemID = ElemID.fromFullName(scope)
      if (!elemID.isTopLevel()) {
        return scope
      }
    } catch (error) {
      return scope
    }
    return undefined
  }).filter(values.isDefined)
  if (invalidScopes.length > 0) {
    errorOutputLine(`ElementScopes must be a valid Top Level Element ID, these are not - ${invalidScopes.join(', ')}`, cliOutput)
    return false
  }
  return true
}

type FetchArgs = {
  force: boolean
  stateOnly: boolean
  regenerateSaltoIds: boolean
  fromWorkspace?: string
  fromEnv?: string
  fromState: boolean
  elementsScope?: string[]
} & AccountsArg & EnvArg & UpdateModeArg

export const action: WorkspaceCommandAction<FetchArgs> = async ({
  input,
  cliTelemetry,
  config,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const {
    force, stateOnly, accounts, mode, regenerateSaltoIds,
    fromWorkspace, fromEnv, fromState, elementsScope,
  } = input
  if (
    [fromEnv, fromWorkspace].some(values.isDefined)
    && ![fromEnv, fromWorkspace].every(values.isDefined)
  ) {
    errorOutputLine('The fromEnv and fromWorkspace arguments must both be provided.', output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }
  if (elementsScope && !fromEnv) {
    errorOutputLine('elementsScope can only be used together with fromEnv and fromWorkspace.', output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }
  if (elementsScope !== undefined && !isElementsScopeValid(elementsScope, output)) {
    return CliExitCode.UserInputError
  }
  const { shouldCalcTotalSize } = config
  await validateAndSetEnv(workspace, input, output)
  const activeAccounts = getAndValidateActiveAccounts(workspace, accounts)
  const stateRecencies = await Promise.all(
    activeAccounts.map(account => workspace.getStateRecency(account))
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
  if (!force && mode !== 'align' && await shouldRecommendAlignMode(workspace, stateRecencies, activeAccounts)) {
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
    fetch: fromWorkspace && fromEnv ? createFetchFromWorkspaceCommand(
      fetchFromWorkspace,
      fromWorkspace,
      fromEnv,
      fromState,
      elementsScope,
    ) : apiFetch,
    getApprovedChanges: cliGetApprovedChanges,
    shouldUpdateConfig: cliShouldUpdateConfig,
    accounts: activeAccounts,
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
      ACCOUNTS_OPTION,
      ENVIRONMENT_OPTION,
      UPDATE_MODE_OPTION,
      {
        name: 'regenerateSaltoIds',
        alias: 'r',
        required: false,
        description: 'Regenerate configuration elements Salto IDs based on the current settings and fetch results',
        type: 'boolean',
      },
      {
        name: 'fromWorkspace',
        alias: 'w',
        required: false,
        description: 'Fetch the data from another workspace at this path',
        type: 'string',
      },
      {
        name: 'fromEnv',
        alias: 'we',
        required: false,
        description: 'Fetch the data from another workspace at this path from this env',
        type: 'string',
      },
      {
        name: 'fromState',
        alias: 'ws',
        required: false,
        description: 'Fetch the data from another workspace from the state',
        type: 'boolean',
        default: false,
      },
      {
        name: 'elementsScope',
        alias: 'es',
        required: false,
        description: 'The scope of the Fetch From workspace',
        type: 'stringsList',
      },
    ],
  },
  action,
  extraTelemetryTags: getTagsForAccounts,
})

export default fetchDef
