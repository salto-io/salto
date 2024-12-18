/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Workspace } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { calculatePatch, syncWorkspaceToFolder, initFolder, isInitializedFolder } from '@salto-io/core'
import { WorkspaceCommandAction, createWorkspaceCommand, createCommandGroupDef } from '../command_builder'
import { outputLine, errorOutputLine } from '../outputer'
import { validateWorkspace, formatWorkspaceErrors } from '../workspace/workspace'
import { CliExitCode, CliOutput } from '../types'
import { UpdateModeArg, UPDATE_MODE_OPTION } from './common/update_mode'
import { formatFetchWarnings, formatSyncToWorkspaceErrors } from '../formatter'
import { getUserBooleanInput } from '../callbacks'

const log = logger(module)
const { awu } = collections.asynciterable

const APPLY_PATCH_ADAPTERS = ['salesforce', 'netsuite', 'dummy'] as const
type ApplyPatchAdapters = (typeof APPLY_PATCH_ADAPTERS)[number]
type ApplyPatchArgs = {
  fromDir: string
  toDir: string
  accountName: ApplyPatchAdapters
  targetEnvs?: string[]
  updateStateInEnvs?: string[]
} & UpdateModeArg

const applyPatchToWorkspace = async (
  workspace: Workspace,
  input: ApplyPatchArgs,
  updateState: boolean,
  output: CliOutput,
): Promise<boolean> => {
  const { fromDir, toDir, accountName } = input
  const { changes, fetchErrors, mergeErrors } = await calculatePatch({
    workspace,
    fromDir,
    toDir,
    accountName,
  })
  if (mergeErrors.length > 0) {
    const mergeErrorsValues = await awu(mergeErrors.values()).flat().toArray()
    errorOutputLine('Encountered merge errors in elements:', output)
    errorOutputLine(await formatWorkspaceErrors(workspace, mergeErrorsValues), output)
    return false
  }
  outputLine(`Found ${changes.length} changes to apply`, output)
  const conflicts = changes.filter(change => !_.isEmpty(change.pendingChanges))
  conflicts.forEach(change => {
    log.info(
      'Conflict between pending change IDs %s and incoming IDs %s',
      change.pendingChanges?.map(pending => pending.id.getFullName()),
      change.serviceChanges.map(service => service.id.getFullName()),
    )
  })
  if (conflicts.length > 0) {
    errorOutputLine(
      `Failed to update env ${workspace.currentEnv()} because there are ${conflicts.length} conflicting changes`,
      output,
    )
    return false
  }
  if (fetchErrors.length > 0) {
    // We currently assume all fetchErrors are warnings
    log.debug(`apply-patch had ${fetchErrors.length} warnings`)
    outputLine(formatFetchWarnings(fetchErrors.map(fetchError => fetchError.detailedMessage)), output)
  }
  if (updateState) {
    outputLine(`Updating state for environment ${workspace.currentEnv()}`, output)
    await workspace.state().updateStateFromChanges({ changes: changes.map(change => change.change) })
  }
  outputLine(`Updating NaCl for environment ${workspace.currentEnv()}`, output)
  await workspace.updateNaclFiles(
    changes.map(change => change.change),
    input.mode,
  )
  const { status, errors } = await validateWorkspace(workspace)
  if (status === 'Error') {
    const formattedErrors = await formatWorkspaceErrors(workspace, errors)
    errorOutputLine(`Failed to update env ${workspace.currentEnv()}, errors: ${formattedErrors}`, output)
    return false
  }
  return true
}

export const applyPatchAction: WorkspaceCommandAction<ApplyPatchArgs> = async ({ workspace, input, output }) => {
  const targetEnvs = input.targetEnvs ?? workspace.envs()
  const unknownEnvs = targetEnvs.concat(input.updateStateInEnvs ?? []).filter(env => !workspace.envs().includes(env))
  if (unknownEnvs.length > 0) {
    errorOutputLine(`Unknown environments ${unknownEnvs}`, output)
    return CliExitCode.UserInputError
  }

  let success = true
  await awu(targetEnvs).forEach(async env => {
    if (!success) {
      return
    }
    await workspace.setCurrentEnv(env, false)
    const updateState = input.updateStateInEnvs?.includes(env) ?? false
    success = await applyPatchToWorkspace(workspace, input, updateState, output)
  })

  if (success) {
    outputLine('Flushing workspace', output)
    await workspace.flush()
  }
  return success ? CliExitCode.Success : CliExitCode.AppError
}

const applyPatchCmd = createWorkspaceCommand({
  properties: {
    name: 'apply-patch',
    description: 'Calculate the difference between two SFDX folders and apply it to the workspace',
    keyedOptions: [
      {
        name: 'accountName',
        alias: 't',
        description:
          'The account name for elements, this determines the expected format of the elements in the directories',
        type: 'string',
        required: true,
        choices: [...APPLY_PATCH_ADAPTERS],
      },
      {
        name: 'targetEnvs',
        alias: 'e',
        type: 'stringsList',
        description: 'Names for environments to apply the changes to, defaults to all environments',
      },
      {
        name: 'updateStateInEnvs',
        alias: 'u',
        type: 'stringsList',
        description:
          'Names for environments in which to update the state as well as the NaCls, indicating that the changes were already deployed',
      },
      UPDATE_MODE_OPTION,
    ],
    positionalOptions: [
      {
        name: 'fromDir',
        required: true,
        type: 'string',
        description: 'SFDX folder that contains the base of the change (before)',
      },
      {
        name: 'toDir',
        required: true,
        type: 'string',
        description: 'SFDX folder that contains the changed configuration (after)',
      },
    ],
  },
  action: applyPatchAction,
})

const SYNC_WORKSPACE_ADAPTERS = ['salesforce', 'dummy'] as const
type SyncWorkspaceAdapters = (typeof SYNC_WORKSPACE_ADAPTERS)[number]

type SyncWorkspaceToFolderArgs = {
  toDir: string
  accountName: SyncWorkspaceAdapters
  force: boolean
}
export const syncWorkspaceToFolderAction: WorkspaceCommandAction<SyncWorkspaceToFolderArgs> = async ({
  workspace,
  input,
  output,
}) => {
  const { accountName, toDir, force } = input
  const adapterName = workspace.getServiceFromAccountName(accountName)
  const initializedResult = await isInitializedFolder({ adapterName, baseDir: toDir })
  if (initializedResult.errors.length > 0) {
    outputLine(formatSyncToWorkspaceErrors(initializedResult.errors), output)
    return CliExitCode.AppError
  }

  if (!initializedResult.result) {
    if (force || (await getUserBooleanInput('The folder is no initialized for the adapter format, initialize?'))) {
      outputLine(`Initializing adapter format folder at ${toDir}`, output)
      const initResult = await initFolder({ adapterName, baseDir: toDir })
      if (initResult.errors.length > 0) {
        outputLine(formatSyncToWorkspaceErrors(initResult.errors), output)
        return CliExitCode.AppError
      }
    } else {
      outputLine('Folder not initialized for adapter format, aborting', output)
      return CliExitCode.UserInputError
    }
  }

  outputLine(`Synchronizing content of workspace to folder at ${toDir}`, output)
  const result = await syncWorkspaceToFolder({ workspace, accountName, baseDir: toDir })
  if (result.errors.length > 0) {
    outputLine(formatSyncToWorkspaceErrors(result.errors), output)
    return CliExitCode.AppError
  }

  return CliExitCode.Success
}

const syncToWorkspaceCmd = createWorkspaceCommand({
  properties: {
    name: 'sync-to-folder',
    description: 'Synchronize the content of a workspace with a project folder',
    keyedOptions: [
      {
        name: 'toDir',
        type: 'string',
        alias: 'd',
        description: 'The project folder to update',
        required: true,
      },
      {
        name: 'accountName',
        type: 'string',
        alias: 'a',
        description: 'The name of the account to synchronize to the project',
        choices: [...SYNC_WORKSPACE_ADAPTERS],
        default: 'salesforce',
      },
      {
        name: 'force',
        type: 'boolean',
        alias: 'f',
        description: 'Initialize the folder for adapter format if needed',
        default: false,
      },
    ],
  },
  action: syncWorkspaceToFolderAction,
  loadWorkspaceArgs: { persistent: false },
})

export const adapterFormatGroupDef = createCommandGroupDef({
  properties: {
    name: 'adapter-format',
    description: 'Commands that deal with project folders in adapter specific formats (e.g - salesforce SFDX)',
  },
  subCommands: [applyPatchCmd, syncToWorkspaceCmd],
})
