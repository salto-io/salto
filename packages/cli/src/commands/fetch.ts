/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { EOL } from 'os'
import _ from 'lodash'
import wu from 'wu'
import { getChangeData, isInstanceElement, AdapterOperationName, Progress } from '@salto-io/adapter-api'
import { adapterCreators } from '@salto-io/adapter-creators'
import {
  fetch as apiFetch,
  FetchFunc,
  FetchChange,
  FetchProgressEvents,
  StepEmitter,
  PlanItem,
  FetchFromWorkspaceFunc,
  fetchFromWorkspace,
  FetchFuncParams,
} from '@salto-io/core'
import { loadLocalWorkspace } from '@salto-io/local-workspace'
import { Workspace, nacl, createElementSelectors, ElementSelector } from '@salto-io/workspace'
import { promises, values } from '@salto-io/lowerdash'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import { progressOutputer, outputLine, errorOutputLine } from '../outputer'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { CliOutput, CliExitCode, CliTelemetry } from '../types'
import {
  formatMergeErrors,
  formatFetchHeader,
  formatFetchFinish,
  formatStateChanges,
  formatAppliedChanges,
  formatFetchWarnings,
  formatAdapterProgress,
  formatInvalidFilters,
  error,
} from '../formatter'
import { getApprovedChanges as cliGetApprovedChanges, shouldUpdateConfig as cliShouldUpdateConfig } from '../callbacks'
import { updateStateOnly, applyChangesToWorkspace, isValidWorkspaceForCommand } from '../workspace/workspace'
import Prompts from '../prompts'
import { ENVIRONMENT_OPTION, EnvArg, validateAndSetEnv } from './common/env'
import { ACCOUNTS_OPTION, AccountsArg, getAndValidateActiveAccounts, getTagsForAccounts } from './common/accounts'
import { UpdateModeArg, UPDATE_MODE_OPTION } from './common/update_mode'

const log = logger(module)
const { series } = promises.array

type ApproveChangesFunc = (changes: ReadonlyArray<FetchChange>) => Promise<ReadonlyArray<FetchChange>>

type ShouldUpdateConfigFunc = ({ stdout }: CliOutput, introMessage: string, change: PlanItem) => Promise<boolean>

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
  regenerateSaltoIdsForSelectors: ElementSelector[]
  withChangesDetection?: boolean
}

const createFetchFromWorkspaceCommand =
  (
    fetchFromWorkspaceFunc: FetchFromWorkspaceFunc,
    otherWorkspacePath: string,
    env: string,
    fromState: boolean,
  ): FetchFunc =>
  async (args: FetchFuncParams) => {
    let otherWorkspace: Workspace
    try {
      otherWorkspace = await loadLocalWorkspace({
        path: otherWorkspacePath,
        persistent: false,
        adapterCreators,
      })
    } catch (err) {
      throw new Error(`Failed to load source workspace: ${err.message ?? err}`)
    }

    return fetchFromWorkspaceFunc({
      workspace: args.workspace,
      otherWorkspace,
      progressEmitter: args.progressEmitter,
      accounts: args.accounts,
      env,
      fromState,
      adapterCreators,
    })
  }

export const fetchCommand = async ({
  workspace,
  force,
  mode,
  getApprovedChanges,
  shouldUpdateConfig,
  accounts,
  cliTelemetry,
  output,
  fetch,
  shouldCalcTotalSize,
  stateOnly,
  regenerateSaltoIds,
  regenerateSaltoIdsForSelectors,
  withChangesDetection,
}: FetchCommandArgs): Promise<CliExitCode> => {
  const bindedOutputline = (text: string): void => outputLine(text, output)
  const fetchProgress = new EventEmitter<FetchProgressEvents>()
  fetchProgress.on('adaptersDidInitialize', () => {
    bindedOutputline(formatFetchHeader())
  })

  fetchProgress.on('adapterProgress', (adapterName: string, _operationName: AdapterOperationName, progress: Progress) =>
    bindedOutputline(formatAdapterProgress(adapterName, progress.message)),
  )

  fetchProgress.on('stateWillBeUpdated', (progress: StepEmitter, numOfChanges: number) =>
    progressOutputer(
      formatStateChanges(numOfChanges),
      () => Prompts.STATE_ONLY_UPDATE_END,
      Prompts.STATE_ONLY_UPDATE_FAILED(numOfChanges),
      output,
    )(progress),
  )

  fetchProgress.on('changesWillBeFetched', (progress: StepEmitter, adapters: string[]) =>
    progressOutputer(
      Prompts.FETCH_GET_CHANGES_START(adapters),
      () => Prompts.FETCH_GET_CHANGES_FINISH(adapters),
      Prompts.FETCH_GET_CHANGES_FAIL,
      output,
    )(progress),
  )

  fetchProgress.on(
    'diffWillBeCalculated',
    progressOutputer(
      Prompts.FETCH_CALC_DIFF_START,
      () => Prompts.FETCH_CALC_DIFF_FINISH,
      Prompts.FETCH_CALC_DIFF_FAIL,
      output,
    ),
  )
  fetchProgress.on('workspaceWillBeUpdated', (progress: StepEmitter, _changes: number, approved: number) => {
    log.debug(`Applying ${approved} semantic changes to the local workspace`)

    progressOutputer(
      Prompts.APPLYING_CHANGES,
      formatAppliedChanges,
      Prompts.FETCH_UPDATE_WORKSPACE_FAIL,
      output,
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

  const fetchResult = await fetch({
    workspace,
    progressEmitter: fetchProgress,
    accounts,
    ignoreStateElemIdMapping: regenerateSaltoIds,
    withChangesDetection,
    ignoreStateElemIdMappingForSelectors: regenerateSaltoIdsForSelectors,
    adapterCreators,
  })

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
        const shouldWriteToConfig =
          force ||
          (await shouldUpdateConfig(output, fetchResult.accountNameToConfigMessage?.[accountName] || '', planItem))
        if (shouldWriteToConfig) {
          await workspace.updateAccountConfig(
            workspace.getServiceFromAccountName(accountName),
            fetchResult.updatedConfig[accountName],
            accountName,
          )
        }
        return !shouldWriteToConfig
      }),
    )

    if (_.some(abortRequests)) {
      return CliExitCode.UserInputError
    }
  }

  cliTelemetry.changes(fetchResult.changes.length)

  const updatingWsSucceeded = stateOnly
    ? await applyChangesToState(fetchResult.changes)
    : await applyChangesToWorkspace({
        workspace,
        cliTelemetry,
        force,
        shouldCalcTotalSize,
        output,
        changes: fetchResult.changes,
        mode,
        approveChangesCallback: getApprovedChanges,
        applyProgress: fetchProgress,
      })
  if (!_.isEmpty(fetchResult.fetchErrors)) {
    // We currently assume all fetchErrors are warnings
    log.debug(`fetch had ${fetchResult.fetchErrors.length} warnings`)
    bindedOutputline(formatFetchWarnings(fetchResult.fetchErrors.map(fetchError => fetchError.detailedMessage)))
  }
  if (updatingWsSucceeded) {
    bindedOutputline(formatFetchFinish())
    return CliExitCode.Success
  }
  return CliExitCode.AppError
}

type FetchArgs = {
  force: boolean
  stateOnly: boolean
  regenerateSaltoIds: boolean
  regenerateSaltoIdsForSelectors?: string[]
  fromWorkspace?: string
  fromEnv?: string
  fromState: boolean
  withChangesDetection?: boolean
} & AccountsArg &
  EnvArg &
  UpdateModeArg

export const action: WorkspaceCommandAction<FetchArgs> = async ({
  input,
  cliTelemetry,
  config,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const {
    force,
    stateOnly,
    accounts,
    mode,
    regenerateSaltoIds,
    regenerateSaltoIdsForSelectors: regenerateSaltoIdsForSelectorsInput = [],
    fromWorkspace,
    fromEnv,
    fromState,
    withChangesDetection,
  } = input

  if ([fromEnv, fromWorkspace].some(values.isDefined) && ![fromEnv, fromWorkspace].every(values.isDefined)) {
    errorOutputLine('The fromEnv and fromWorkspace arguments must both be provided.', output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }

  const { validSelectors: regenerateSaltoIdsForSelectors, invalidSelectors } = createElementSelectors(
    regenerateSaltoIdsForSelectorsInput,
  )
  if (invalidSelectors.length > 0) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  if (!regenerateSaltoIds && regenerateSaltoIdsForSelectors.length > 0) {
    errorOutputLine(
      error('The regenerateSaltoIds arg must be provided in order to use the regenerateSaltoIdsForSelectors arg'),
      output,
    )
    return CliExitCode.UserInputError
  }

  const { shouldCalcTotalSize } = config
  await validateAndSetEnv(workspace, input, output)
  const activeAccounts = getAndValidateActiveAccounts(workspace, accounts)

  const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator, force })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  return fetchCommand({
    workspace,
    force,
    cliTelemetry,
    output,
    fetch:
      fromWorkspace && fromEnv
        ? createFetchFromWorkspaceCommand(fetchFromWorkspace, fromWorkspace, fromEnv, fromState)
        : apiFetch,
    getApprovedChanges: cliGetApprovedChanges,
    shouldUpdateConfig: cliShouldUpdateConfig,
    accounts: activeAccounts,
    mode,
    shouldCalcTotalSize,
    stateOnly,
    withChangesDetection,
    regenerateSaltoIds,
    regenerateSaltoIdsForSelectors,
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
        name: 'regenerateSaltoIdsForSelectors',
        alias: 'rs',
        required: false,
        description: 'Selectors for Salto IDs regeneration',
        type: 'stringsList',
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
        name: 'withChangesDetection',
        alias: 'cd',
        required: false,
        description:
          'Improve fetch performance by relying on the service audit trail in order to fetch only elements that were modified or created since the last fetch',
        type: 'boolean',
        default: false,
      },
    ],
  },
  action,
  extraTelemetryTags: getTagsForAccounts,
})

export default fetchDef
