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
import { logger } from '@salto-io/logging'
import { Workspace } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { calculatePatch } from '@salto-io/core'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { outputLine, errorOutputLine } from '../outputer'
import { validateWorkspace, formatWorkspaceErrors } from '../workspace/workspace'
import { CliExitCode, CliOutput } from '../types'
import { UpdateModeArg, UPDATE_MODE_OPTION } from './common/update_mode'
import { formatFetchWarnings } from '../formatter'

const log = logger(module)
const { awu } = collections.asynciterable

type ApplyPatchArgs = {
  fromDir: string
  toDir: string
  accountName: 'salesforce' | 'netsuite'
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
    outputLine(formatFetchWarnings(fetchErrors.map(fetchError => fetchError.message)), output)
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

const ApplyPatchCmd = createWorkspaceCommand({
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
        choices: ['salesforce', 'netsuite'],
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

export default ApplyPatchCmd
