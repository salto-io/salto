/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections, promises } from '@salto-io/lowerdash'
import { applyFunctionToChangeDataSync } from '@salto-io/adapter-utils'
import { Progress } from '@salto-io/adapter-api'
import { adapterCreators } from '@salto-io/adapter-creators'
import {
  PlanItem,
  Plan,
  preview,
  DeployResult,
  ItemStatus,
  deploy,
  summarizeDeployChanges,
  GroupProperties,
  DeploySummaryResult,
  DetailedChangeId,
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
  formatDeployActions,
  formatGroups,
  deployErrorsOutput,
  formatDeploymentSummary,
  formatActionUpdate,
} from '../formatter'
import Prompts from '../prompts'
import { getUserBooleanInput } from '../callbacks'
import { updateWorkspace, isValidWorkspaceForCommand } from '../workspace/workspace'
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

const getReversedSummarizeDeployChanges = (
  summary: Record<DetailedChangeId, DeploySummaryResult>,
): Record<DeploySummaryResult, DetailedChangeId[]> => {
  const resultToElemId: Record<DeploySummaryResult, DetailedChangeId[]> = {
    success: [],
    failure: [],
    'partial-success': [],
  }

  Object.entries(summary).forEach(([changeId, resultValue]) => {
    if (resultToElemId[resultValue]) {
      resultToElemId[resultValue].push(changeId)
    }
  })
  return resultToElemId
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

type DeployResultAndSummary = DeployResult & {
  summary: Record<string, DeploySummaryResult>
}

const deployPlan = async (
  actionPlan: Plan,
  workspace: Workspace,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  checkOnly: boolean,
  accounts?: string[],
): Promise<DeployResultAndSummary> => {
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

  const cancelAction = (itemName: string, details: string): void => {
    outputLine(formatCancelAction(itemName, details), output)
  }

  const startAction = (itemName: string, item: PlanItem, details?: string): void => {
    if (actions[itemName] && details) {
      outputLine(formatActionUpdate(itemName, details), output)
      return
    }

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

  const updateAction = (item: PlanItem, status: ItemStatus, details?: string | Progress): void => {
    const itemName = item.groupKey
    if (itemName) {
      const detailsString = _.isString(details) ? details : details?.message
      if (status === 'started') {
        startAction(itemName, item, detailsString)
      } else if (actions[itemName] !== undefined && status === 'finished') {
        endAction(itemName)
      } else if (actions[itemName] !== undefined && status === 'error' && detailsString !== undefined) {
        errorAction(itemName, detailsString)
      } else if (status === 'cancelled' && detailsString) {
        cancelAction(itemName, detailsString)
      }
    }
  }
  // the plan will be mutated by deploy, we clone it before that so we can later compare the result
  const requestedChanges = Array.from(actionPlan.itemsByEvalOrder())
    .flatMap(item => Array.from(item.changes()))
    .map(change => applyFunctionToChangeDataSync(change, element => element.clone()))

  const result = await deploy({
    workspace,
    actionPlan,
    reportProgress: updateAction,
    accounts,
    checkOnly,
    adapterCreators,
  })

  const summary = summarizeDeployChanges(requestedChanges, result.appliedChanges ?? [])
  const nonErroredActions = Object.keys(actions).filter(
    action => !result.errors.map(error => error !== undefined && error.groupId).includes(action),
  )
  outputLine(deployErrorsOutput(result.errors), output)
  outputLine(deployPhaseEpilogue(nonErroredActions.length, result.errors.length, checkOnly), output)
  log.debug(`${result.errors.length} errors occurred:\n${result.errors.map(err => err.detailedMessage).join('\n')}`)

  cliTelemetry.actionsSuccess(nonErroredActions.length)
  cliTelemetry.actionsFailure(result.errors.length)

  // Since we are done deploying, clear any leftover intervals
  Object.values(actions)
    .filter(action => action.intervalId)
    .forEach(action => clearInterval(action.intervalId))

  return { ...result, summary }
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

  const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator, force })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  const actionPlan = await preview({ workspace, accounts: actualAccounts, checkOnly, adapterCreators })
  await printPlan(actionPlan, output, workspace, detailedPlan)
  const executingDeploy = !dryRun && (force || (await shouldDeploy(actionPlan, checkOnly)))
  if (!dryRun) {
    await printStartDeploy(output, executingDeploy, checkOnly)
  }
  const result = executingDeploy
    ? await deployPlan(actionPlan, workspace, cliTelemetry, output, checkOnly, actualAccounts)
    : { success: true, errors: [], summary: {} }
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

  const changeErrorsForPostDeployOutput = actionPlan.changeErrors.filter(
    changeError =>
      result.summary[changeError.elemID.getFullName()] !== 'failure' ||
      changeError.deployActions?.postAction?.showOnFailure,
  )

  if (executingDeploy) {
    const formattedDeploymentSummary = formatDeploymentSummary(getReversedSummarizeDeployChanges(result.summary))
    if (formattedDeploymentSummary) {
      outputLine(formattedDeploymentSummary, output)
    }
  }
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
