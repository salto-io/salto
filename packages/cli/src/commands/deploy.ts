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
import { EOL } from 'os'
import { promises } from '@salto-io/lowerdash'
import { PlanItem, Plan, preview, DeployResult, ItemStatus, deploy } from '@salto-io/core'
import { logger } from '@salto-io/logging'
import { Workspace } from '@salto-io/workspace'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { ServicesArg, SERVICES_OPTION, getAndValidateActiveAccounts } from './common/services'
import { CliOutput, CliExitCode, CliTelemetry } from '../types'
import { outputLine, errorOutputLine } from '../outputer'
import { header, formatExecutionPlan, deployPhaseHeader, cancelDeployOutput, formatItemDone, formatItemError, formatCancelAction, formatActionInProgress, formatActionStart, deployPhaseEpilogue, formatStateRecencies } from '../formatter'
import Prompts from '../prompts'
import { getUserBooleanInput } from '../callbacks'
import { getWorkspaceTelemetryTags, updateWorkspace, isValidWorkspaceForCommand, shouldRecommendFetch } from '../workspace/workspace'
import { ENVIRONMENT_OPTION, EnvArg, validateAndSetEnv } from './common/env'

const log = logger(module)

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

const printStartDeploy = async (output: CliOutput, executingDeploy: boolean): Promise<void> => {
  if (executingDeploy) {
    outputLine(deployPhaseHeader, output)
  } else {
    outputLine(cancelDeployOutput, output)
  }
}

export const shouldDeploy = async (
  actions: Plan,
): Promise<boolean> => {
  if (_.isEmpty(actions)) {
    return false
  }
  return getUserBooleanInput(Prompts.SHOULD_EXECUTE_PLAN)
}

type DeployArgs = {
  force: boolean
  dryRun: boolean
  detailedPlan: boolean
} & ServicesArg & EnvArg

const deployPlan = async (
  actionPlan: Plan,
  workspace: Workspace,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  force: boolean,
  services?: string[],
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
      } else if (actions[itemName] !== undefined && status === 'error' && details) {
        errorAction(itemName, details)
      } else if (status === 'cancelled' && details) {
        cancelAction(itemName, details)
      }
    }
  }
  const executingDeploy = (force || await shouldDeploy(actionPlan))
  await printStartDeploy(output, executingDeploy)
  const result = executingDeploy
    ? await deploy(
      workspace,
      actionPlan,
      (item: PlanItem, step: ItemStatus, details?: string) =>
        updateAction(item, step, details),
      services,
    ) : { success: true, errors: [] }
  const nonErroredActions = Object.keys(actions)
    .filter(action =>
      !result.errors.map(error => error !== undefined && error.elementId).includes(action))
  outputLine(deployPhaseEpilogue(
    nonErroredActions.length,
    result.errors.length,
  ), output)
  output.stdout.write(EOL)
  log.debug(`${result.errors.length} errors occurred:\n${result.errors.map(err => err.message).join('\n')}`)

  if (executingDeploy) {
    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.actionsSuccess(nonErroredActions.length, workspaceTags)
    cliTelemetry.actionsFailure(result.errors.length, workspaceTags)
  }

  return result
}

export const action: WorkspaceCommandAction<DeployArgs> = async ({
  input,
  cliTelemetry,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { force, dryRun, detailedPlan, services } = input
  await validateAndSetEnv(workspace, input, output)
  const actualServices = getAndValidateActiveAccounts(workspace, services)
  const stateRecencies = await Promise.all(
    actualServices.map(service => workspace.getStateRecency(service))
  )
  // Print state recencies
  outputLine(formatStateRecencies(stateRecencies), output)

  const validWorkspace = await isValidWorkspaceForCommand(
    { workspace, cliOutput: output, spinnerCreator, force }
  )
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  // Validate state recencies
  const stateSaltoVersion = await workspace.state().getStateSaltoVersion()
  const invalidRecencies = stateRecencies.filter(recency => recency.status !== 'Valid')
  if (!force && await shouldRecommendFetch(stateSaltoVersion, invalidRecencies, output)) {
    return CliExitCode.AppError
  }

  const actionPlan = await preview(workspace, actualServices)
  await printPlan(actionPlan, output, workspace, detailedPlan)

  const result = dryRun ? { success: true, errors: [] } : await deployPlan(
    actionPlan,
    workspace,
    cliTelemetry,
    output,
    force,
    actualServices,
  )
  let cliExitCode = result.success ? CliExitCode.Success : CliExitCode.AppError
  if (!_.isUndefined(result.changes)) {
    const changes = [...result.changes]
    if (!(await updateWorkspace({
      workspace,
      output,
      changes,
      force,
    })).success) {
      cliExitCode = CliExitCode.AppError
    }
  }
  return cliExitCode
}

const deployDef = createWorkspaceCommand({
  properties: {
    name: 'deploy',
    description: 'Update the upstream services from the workspace configuration elements',
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
      SERVICES_OPTION,
      ENVIRONMENT_OPTION,
    ],
  },
  action,
})

export default deployDef
