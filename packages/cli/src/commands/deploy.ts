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
import { EOL } from 'os'
import { collections, promises } from '@salto-io/lowerdash'
import {
  PlanItem,
  Plan,
  preview,
  DeployResult,
  ItemStatus,
  deploy,
  summarizeDeployChanges,
  GroupProperties,
} from '@salto-io/core'
import { logger } from '@salto-io/logging'
import { Workspace } from '@salto-io/workspace'
import { mkdirp, writeFile } from '@salto-io/file'
import path from 'path'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { AccountsArg, ACCOUNTS_OPTION, getAndValidateActiveAccounts, getTagsForAccounts } from './common/accounts'
import { CliOutput, CliExitCode, CliTelemetry } from '../types'
import { outputLine, errorOutputLine } from '../outputer'
import {
  header,
  formatExecutionPlan,
  deployPhaseHeader,
  cancelDeployOutput,
  formatItemDone,
  formatItemError,
  formatCancelAction,
  formatActionInProgress,
  formatActionStart,
  deployPhaseEpilogue,
  formatStateRecencies,
  formatDeployActions,
  formatGroups,
  deployErrorsOutput,
} from '../formatter'
import Prompts from '../prompts'
import { getUserBooleanInput } from '../callbacks'
import { updateWorkspace, isValidWorkspaceForCommand, shouldRecommendFetch } from '../workspace/workspace'
import { ENVIRONMENT_OPTION, EnvArg, validateAndSetEnv } from './common/env'

const log = logger(module)
const { makeArray } = collections.array

const ACTION_INPROGRESS_INTERVAL = 5000

type Action = {
  item: PlanItem
  startTime: Date
  intervalId: ReturnType<typeof setTimeout>
}

const printPlan = async (
  actions: Plan,
  output: CliOutput,
  workspace: Workspace,
  detailedPlan: boolean,
): Promise<void> => {
  const planWorkspaceErrors = await promises.array.withLimitedConcurrency(
    actions.changeErrors.map(ce => () => workspace.transformToWorkspaceError(ce)),
    20,
  )
  outputLine(header(Prompts.PLAN_STEPS_HEADER_DEPLOY), output)
  outputLine(await formatExecutionPlan(actions, planWorkspaceErrors, detailedPlan), output)
}

const printStartDeploy = async (output: CliOutput, executingDeploy: boolean, checkOnly: boolean): Promise<void> => {
  if (executingDeploy) {
    outputLine(deployPhaseHeader(checkOnly), output)
  } else {
    outputLine(cancelDeployOutput(checkOnly), output)
  }
}

export const shouldDeploy = async (actions: Plan, checkOnly: boolean): Promise<boolean> => {
  if (_.isEmpty(actions)) {
    return false
  }
  return getUserBooleanInput(Prompts.SHOULD_EXECUTE_DEPLOY_PLAN(checkOnly))
}

type DeployArgs = {
  force: boolean
  dryRun: boolean
  detailedPlan: boolean
  checkOnly: boolean
  artifactsDir?: string
} & AccountsArg &
  EnvArg

const deployPlan = async (
  actionPlan: Plan,
  workspace: Workspace,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  force: boolean,
  checkOnly: boolean,
  accounts?: string[],
): Promise<DeployResult> => {
  const actions: Record<string, Action> = {}
  const endAction = (itemName: string): void => {
    const action = actions[itemName]
    if (action !== undefined) {
      if (action.startTime && action.item) {
        outputLine(formatItemDone(action.item, action.startTime), output)
      }
      if (action.intervalId) {
        clearInterval(action.intervalId)
      }
    }
  }

  const errorAction = (itemName: string, details: string): void => {
    const action = actions[itemName]
    if (action !== undefined) {
      errorOutputLine(formatItemError(itemName, details), output)
      if (action.intervalId) {
        clearInterval(action.intervalId)
      }
    }
  }

  const cancelAction = (itemName: string, parentItemName: string): void => {
    outputLine(formatCancelAction(itemName, parentItemName), output)
  }

  const startAction = (itemName: string, item: PlanItem): void => {
    const startTime = new Date()
    const intervalId = setInterval(() => {
      outputLine(formatActionInProgress(itemName, item.action, startTime), output)
    }, ACTION_INPROGRESS_INTERVAL)
    const action = {
      item,
      startTime,
      intervalId,
    }
    actions[itemName] = action
    outputLine(formatActionStart(item), output)
  }

  const updateAction = (item: PlanItem, status: ItemStatus, details?: string): void => {
    const itemName = item.groupKey
    if (itemName) {
      if (status === 'started') {
        startAction(itemName, item)
      } else if (actions[itemName] !== undefined && status === 'finished') {
        endAction(itemName)
      } else if (actions[itemName] !== undefined && status === 'error' && details !== undefined) {
        errorAction(itemName, details)
      } else if (status === 'cancelled' && details) {
        cancelAction(itemName, details)
      }
    }
  }
  const executingDeploy = force || (await shouldDeploy(actionPlan, checkOnly))
  await printStartDeploy(output, executingDeploy, checkOnly)
  const result = executingDeploy
    ? await deploy(
        workspace,
        actionPlan,
        (item: PlanItem, step: ItemStatus, details?: string) => updateAction(item, step, details),
        accounts,
        checkOnly,
      )
    : { success: true, errors: [] }
  const nonErroredActions = Object.keys(actions).filter(
    action => !result.errors.map(error => error !== undefined && error.groupId).includes(action),
  )
  outputLine(deployErrorsOutput(result.errors), output)
  outputLine(deployPhaseEpilogue(nonErroredActions.length, result.errors.length, checkOnly), output)
  output.stdout.write(EOL)
  log.debug(`${result.errors.length} errors occurred:\n${result.errors.map(err => err.message).join('\n')}`)

  if (executingDeploy) {
    cliTelemetry.actionsSuccess(nonErroredActions.length)
    cliTelemetry.actionsFailure(result.errors.length)
  }

  return result
}

type GroupWithArtifacts = GroupProperties & Required<Pick<GroupProperties, 'artifacts'>>
const isGroupWithArtifacts = (group: GroupProperties): group is GroupWithArtifacts =>
  group.artifacts !== undefined && group.artifacts.length > 0

const writeArtifacts = async ({ extraProperties }: DeployResult, artifactsDir?: string): Promise<void> => {
  try {
    const groupsWithArtifacts = makeArray(extraProperties?.groups).filter(isGroupWithArtifacts)
    if (artifactsDir === undefined || groupsWithArtifacts.length === 0) {
      return
    }
    const artifactsByAccountName = _(groupsWithArtifacts)
      .groupBy(group => group.accountName)
      .mapValues(groups => groups.flatMap(group => group.artifacts))
      .value()
    await Promise.all(
      Object.entries(artifactsByAccountName).map(async ([accountName, artifacts]) => {
        const accountArtifactsDir = path.join(artifactsDir, accountName)
        await mkdirp(accountArtifactsDir)
        await Promise.all(
          artifacts.map(async artifact => {
            const artifactPath = path.join(accountArtifactsDir, artifact.name)
            await writeFile(artifactPath, artifact.content)
            log.debug('Successfully wrote artifact %s', artifactPath)
          }),
        )
      }),
    )
  } catch (e: unknown) {
    log.error('Error occurred while writing artifacts: %o', e)
  }
}

export const action: WorkspaceCommandAction<DeployArgs> = async ({
  input,
  cliTelemetry,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { force, dryRun, detailedPlan, accounts, checkOnly } = input
  await validateAndSetEnv(workspace, input, output)
  const actualAccounts = getAndValidateActiveAccounts(workspace, accounts)
  const stateRecencies = await Promise.all(actualAccounts.map(account => workspace.getStateRecency(account)))
  // Print state recencies
  outputLine(formatStateRecencies(stateRecencies), output)

  const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator, force })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  // Validate state recencies
  const stateSaltoVersion = await workspace.state().getStateSaltoVersion()
  const invalidRecencies = stateRecencies.filter(recency => recency.status !== 'Valid')
  if (!force && (await shouldRecommendFetch(stateSaltoVersion, invalidRecencies, output))) {
    return CliExitCode.AppError
  }

  const actionPlan = await preview(workspace, actualAccounts, checkOnly)
  await printPlan(actionPlan, output, workspace, detailedPlan)

  const result = dryRun
    ? { success: true, errors: [] }
    : await deployPlan(actionPlan, workspace, cliTelemetry, output, force, checkOnly, actualAccounts)
  await writeArtifacts(result, input.artifactsDir)
  let cliExitCode = result.success ? CliExitCode.Success : CliExitCode.AppError
  // We don't flush the workspace for check-only deployments
  if (!_.isUndefined(result.changes) && !checkOnly) {
    const changes = [...result.changes]
    if (
      !(
        await updateWorkspace({
          workspace,
          output,
          changes,
          force,
        })
      ).success
    ) {
      cliExitCode = CliExitCode.AppError
    }
  }

  const requested = Array.from(actionPlan.itemsByEvalOrder()).flatMap(item => Array.from(item.changes()))
  const summary = summarizeDeployChanges(requested, result.appliedChanges ?? [])
  const changeErrorsForPostDeployOutput = actionPlan.changeErrors.filter(
    changeError =>
      summary[changeError.elemID.getFullName()] !== 'failure' || changeError.deployActions?.postAction?.showOnFailure,
  )

  const postDeployActionsOutput = formatDeployActions({
    wsChangeErrors: changeErrorsForPostDeployOutput,
    isPreDeploy: false,
  })
  outputLine(postDeployActionsOutput.join('\n'), output)
  if (result.extraProperties?.groups !== undefined) {
    outputLine(formatGroups(result.extraProperties?.groups, checkOnly), output)
  }
  return cliExitCode
}

const deployDef = createWorkspaceCommand({
  properties: {
    name: 'deploy',
    description: 'Update the upstream accounts from the workspace configuration elements',
    keyedOptions: [
      {
        name: 'force',
        alias: 'f',
        description: 'Do not ask for approval before deploying the changes',
        type: 'boolean',
      },
      {
        name: 'dryRun',
        alias: 'd',
        description: 'Print the execution plan without deploying',
        type: 'boolean',
      },
      {
        name: 'detailedPlan',
        alias: 'p',
        description: 'Print detailed plan including value changes',
        type: 'boolean',
      },
      {
        name: 'checkOnly',
        alias: 'c',
        required: false,
        description: 'Run check-only deployment against the service',
        type: 'boolean',
      },
      {
        name: 'artifactsDir',
        alias: 'a',
        required: false,
        description: 'The directory to write the deploy artifacts to',
        type: 'string',
      },
      ACCOUNTS_OPTION,
      ENVIRONMENT_OPTION,
    ],
  },
  action,
  extraTelemetryTags: getTagsForAccounts,
})

export default deployDef
