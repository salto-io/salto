/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { Workspace, nacl, createElementSelectors } from '@salto-io/workspace'
import { EOL } from 'os'
import { logger } from '@salto-io/logging'
import { CommandConfig, LocalChange, restore, restorePaths as restorePathsCore } from '@salto-io/core'
import { getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { collections, promises, values } from '@salto-io/lowerdash'
import { CliOutput, CliExitCode, CliTelemetry } from '../types'
import { errorOutputLine, outputLine } from '../outputer'
import {
  header,
  formatDetailedChanges,
  formatInvalidFilters,
  formatStepStart,
  formatRestoreFinish,
  formatStepCompleted,
  formatStepFailed,
  formatStateRecencies,
  formatAppliedChanges,
  formatShowWarning,
  formatListRecord,
  formatCancelCommand,
} from '../formatter'
import Prompts from '../prompts'
import { updateWorkspace, isValidWorkspaceForCommand } from '../workspace/workspace'
import { getApprovedChanges, getUserBooleanInput } from '../callbacks'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { AccountsArg, ACCOUNTS_OPTION, getAndValidateActiveAccounts } from './common/accounts'
import { EnvArg, ENVIRONMENT_OPTION, validateAndSetEnv } from './common/env'
import { UpdateModeArg, UPDATE_MODE_OPTION } from './common/update_mode'

const { awu } = collections.asynciterable

const log = logger(module)

const GETTING_CONTENT_CONCURRENCY_LIMIT = 100

const printRestorePlan = async (changes: LocalChange[], detailed: boolean, output: CliOutput): Promise<void> => {
  outputLine(EOL, output)
  outputLine(header(Prompts.RESTORE_CALC_DIFF_RESULT_HEADER), output)
  if (changes.length > 0) {
    outputLine(await formatDetailedChanges([changes.map(change => change.change)], detailed), output)
  } else {
    outputLine('No changes', output)
  }
  outputLine(EOL, output)
}

export const shouldExecuteRestore = async (force: boolean): Promise<boolean> => {
  if (force) {
    return true
  }

  return getUserBooleanInput(Prompts.SHOULD_EXECUTE_RESTORE)
}

type RestoreArgs = {
  elementSelectors?: string[]
  force: boolean
  dryRun: boolean
  detailedPlan: boolean
  listPlannedChanges: boolean
  reorganizeDirStructure?: boolean
} & AccountsArg &
  EnvArg &
  UpdateModeArg

const applyLocalChangesToWorkspace = async (
  changes: LocalChange[],
  workspace: Workspace,
  cliTelemetry: CliTelemetry,
  config: CommandConfig,
  output: CliOutput,
  mode: nacl.RoutingMode,
  force: boolean,
): Promise<boolean> => {
  // If the workspace starts empty there is no point in showing a huge amount of changes
  const changesToApply = force || (await workspace.isEmpty()) ? changes : await getApprovedChanges(changes)

  cliTelemetry.changesToApply(changesToApply.length)
  log.debug(`Applying ${changesToApply.length} semantic changes to the local workspace`)

  // In some cases, Salto won't have the state copy of the static file.
  // So we need to check whether a static file change is restorable
  const changedStaticFiles = await awu(changesToApply)
    // To remove a static file from the workspace, we don't need
    // its state copy so we can ignore here removal changes
    .filter(change => !isRemovalChange(change.change))
    .flatMap(change => getChangeData(change.change))
    .flatMap(nacl.getNestedStaticFiles)
    .toArray()

  const nonRestorableFiles = (
    await promises.array.withLimitedConcurrency(
      changedStaticFiles.map(file => async () => ((await file.getContent()) === undefined ? file : undefined)),
      GETTING_CONTENT_CONCURRENCY_LIMIT,
    )
  ).filter(values.isDefined)

  if (!_.isEmpty(nonRestorableFiles)) {
    outputLine(EOL, output)
    outputLine(formatShowWarning(Prompts.STATIC_RESOURCES_NOT_SUPPORTED), output)
    nonRestorableFiles.forEach(file => {
      outputLine(formatListRecord(file.filepath), output)
    })
  }

  outputLine(EOL, output)
  outputLine(formatStepStart(Prompts.APPLYING_CHANGES), output)

  const results = await updateWorkspace({
    workspace,
    output,
    changes: changesToApply,
    mode,
    force,
  })
  if (results.success) {
    outputLine(formatStepCompleted(formatAppliedChanges(results.numberOfAppliedChanges)), output)
    if (config.shouldCalcTotalSize) {
      const totalSize = await workspace.getTotalSize()
      log.debug(`Total size of the workspace is ${totalSize} bytes`)
      cliTelemetry.workspaceSize(totalSize)
    }
    return true
  }
  outputLine(formatStepFailed(Prompts.RESTORE_UPDATE_WORKSPACE_FAIL), output)
  outputLine(EOL, output)
  return false
}

export const action: WorkspaceCommandAction<RestoreArgs> = async ({
  input,
  cliTelemetry,
  config,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const {
    elementSelectors = [],
    force,
    dryRun,
    detailedPlan,
    listPlannedChanges,
    accounts,
    mode,
    reorganizeDirStructure,
  } = input
  if (elementSelectors.length > 0 && reorganizeDirStructure) {
    errorOutputLine(Prompts.REORGANIZE_DIR_STRUCTURE_WITH_ELEMENT_SELECTORS, output)
    return CliExitCode.UserInputError
  }

  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelectors)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }
  await validateAndSetEnv(workspace, input, output)
  const activeAccounts = getAndValidateActiveAccounts(workspace, accounts)
  const stateRecencies = await Promise.all(activeAccounts.map(account => workspace.getStateRecency(account)))
  // Print state recencies
  outputLine(formatStateRecencies(stateRecencies), output)

  const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator, force })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  outputLine(EOL, output)
  outputLine(formatStepStart(Prompts.RESTORE_CALC_DIFF_START), output)

  let changes: LocalChange[] | undefined
  const getRestoreChanges = async (): Promise<LocalChange[]> => {
    if (changes === undefined) {
      changes = await restore(workspace, activeAccounts, validSelectors)
    }
    return changes
  }

  if (listPlannedChanges || dryRun) {
    await printRestorePlan(await getRestoreChanges(), detailedPlan, output)
  }

  outputLine(formatStepCompleted(Prompts.RESTORE_CALC_DIFF_FINISH), output)

  if (dryRun) {
    return CliExitCode.Success
  }

  // getRestoreChanges() returns only semantic changes so
  // if reorganizeDirStructure is passed we need to proceed
  if (!reorganizeDirStructure && _.isEmpty(await getRestoreChanges())) {
    outputLine(EOL, output)
    outputLine(Prompts.FETCH_NO_CHANGES, output)
    return CliExitCode.Success
  }

  if (!(await shouldExecuteRestore(force))) {
    outputLine(formatCancelCommand, output)
    return CliExitCode.Success
  }

  // The restorePathsCore changes also include the elements'
  // value changes so we when reorganizeDirStructure is passed we need to apply
  // only those and not the changes from restorePathsCore
  const changesToApply = reorganizeDirStructure
    ? await restorePathsCore(workspace, accounts)
    : await getRestoreChanges()

  const updatingWsSucceeded = await applyLocalChangesToWorkspace(
    changesToApply,
    workspace,
    cliTelemetry,
    config,
    output,
    mode,
    force,
  )

  if (updatingWsSucceeded) {
    outputLine(formatRestoreFinish(), output)
    return CliExitCode.Success
  }
  return CliExitCode.AppError
}

const restoreDef = createWorkspaceCommand({
  properties: {
    name: 'restore',
    description: 'Update the workspace configuration elements from the state file',
    positionalOptions: [
      {
        name: 'elementSelectors',
        description: 'Array of configuration element patterns',
        type: 'stringsList',
        required: false,
      },
    ],
    keyedOptions: [
      {
        name: 'force',
        alias: 'f',
        required: false,
        description: 'Do not warn on conflicts with local changes',
        type: 'boolean',
      },
      {
        name: 'dryRun',
        alias: 'd',
        description: 'Preview the changes without updating NaCLs',
        type: 'boolean',
      },
      {
        name: 'detailedPlan',
        alias: 'p',
        description: 'Print detailed plan including value changes',
        type: 'boolean',
      },
      {
        name: 'listPlannedChanges',
        alias: 'l',
        description: 'Print a summary of the planned changes',
        type: 'boolean',
      },
      {
        name: 'reorganizeDirStructure',
        alias: 'r',
        description: 'Reorganize directory structure and move files to their default locations',
        required: false,
        type: 'boolean',
      },
      ACCOUNTS_OPTION,
      ENVIRONMENT_OPTION,
      UPDATE_MODE_OPTION,
    ],
  },
  action,
})

export default restoreDef
