/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { expressions, elementSource, Workspace } from '@salto-io/workspace'
import { loadElementsFromFolder } from '@salto-io/salesforce-adapter'
import { calcFetchChanges } from '@salto-io/core'
import { createCommandGroupDef, WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { outputLine, errorOutputLine } from '../outputer'
import { validateWorkspace, formatWorkspaceErrors } from '../workspace/workspace'
import { CliExitCode, CliOutput } from '../types'

const log = logger(module)
const { awu } = collections.asynciterable

type FetchDiffArgs = {
  fromDir: string
  toDir: string
  targetEnvs?: string[]
}

const fetchDiffToWorkspace = async (
  workspace: Workspace,
  input: FetchDiffArgs,
  output: CliOutput,
): Promise<boolean> => {
  outputLine(`Loading elements from workspace env ${workspace.currentEnv()}`, output)
  const wsElements = await workspace.elements()
  const resolvedWSElements = await expressions.resolve(
    await awu(await wsElements.getAll()).toArray(),
    wsElements,
  )
  const resolvedWSElementSource = elementSource.createInMemoryElementSource(resolvedWSElements)
  outputLine(`Loading elements from ${input.fromDir}`, output)
  const beforeElements = await loadElementsFromFolder(
    input.fromDir,
    resolvedWSElementSource,
  )
  outputLine(`Loading elements from ${input.toDir}`, output)
  const afterElements = await loadElementsFromFolder(
    input.toDir,
    resolvedWSElementSource,
  )

  outputLine(`Calculating difference between ${input.fromDir} and ${input.toDir}`, output)
  const changes = await calcFetchChanges(
    afterElements,
    elementSource.createInMemoryElementSource(afterElements),
    elementSource.createInMemoryElementSource(beforeElements),
    resolvedWSElementSource,
    new Set(['salesforce']),
    new Set(['salesforce']),
  )
  const allChanges = Array.from(changes)

  outputLine(`Found ${allChanges.length} changes to apply`, output)
  const conflicts = allChanges.filter(change => !_.isEmpty(change.pendingChanges))
  conflicts.forEach(change => {
    log.info(
      'Conflict between pending change IDs %s and incoming IDs %s',
      change.pendingChanges?.map(pending => pending.id.getFullName()),
      change.serviceChanges.map(service => service.id.getFullName()),
    )
  })
  if (conflicts.length > 0) {
    errorOutputLine(`Failed to update env ${workspace.currentEnv()} because there are ${conflicts.length} conflicting changes`, output)
    return false
  }
  await workspace.updateNaclFiles(allChanges.map(change => change.change))
  const { status, errors } = await validateWorkspace(workspace)
  if (status === 'Error') {
    const formattedErrors = await formatWorkspaceErrors(workspace, errors)
    errorOutputLine(`Failed to update env ${workspace.currentEnv()}, errors: ${formattedErrors}`, output)
    return false
  }
  return true
}


const fetchDiffAction: WorkspaceCommandAction<FetchDiffArgs> = async ({
  workspace,
  input,
  output,
}) => {
  const targetEnvs = input.targetEnvs ?? workspace.envs()
  const unknownEnvs = targetEnvs.filter(env => !workspace.envs().includes(env))
  if (unknownEnvs.length > 0) {
    errorOutputLine(`Unknown environments ${unknownEnvs}`, output)
    return CliExitCode.UserInputError
  }

  const success = await awu(targetEnvs).every(async env => {
    await workspace.setCurrentEnv(env, false)
    return fetchDiffToWorkspace(workspace, input, output)
  })

  if (success) {
    // unfortunately we must flush each environment because the workspace flush
    // does not handle updates to multiple environments at once
    await awu(targetEnvs).forEach(async env => {
      outputLine(`Flushing environment ${env}`, output)
      await workspace.setCurrentEnv(env, false)
      await workspace.flush()
    })
    // TODO: for some reason this consistently causes cache invalidation, need to figure out why
  }
  return success ? CliExitCode.Success : CliExitCode.AppError
}

const fetchDiffCmd = createWorkspaceCommand({
  properties: {
    name: 'fetch-diff',
    description: 'Calculate the difference between two SFDX folders and apply it to the workspace',
    keyedOptions: [
      {
        name: 'targetEnvs',
        alias: 'e',
        type: 'stringsList',
        description: 'Names for environments to apply the changes to, defaults to all environments',
      },
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
  action: fetchDiffAction,
})

const salesforceGroupDef = createCommandGroupDef({
  properties: {
    name: 'salesforce',
    description: 'Salesforce specific commands',
  },
  subCommands: [
    fetchDiffCmd,
  ],
})

export default salesforceGroupDef
