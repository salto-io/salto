/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { CommandConfig, LocalChange, restore, Tags } from '@salto-io/core'
import { CliOutput, CliExitCode, CliTelemetry } from '../types'
import { errorOutputLine, outputLine } from '../outputer'
import { header, formatDetailedChanges, formatInvalidFilters, formatStepStart, formatRestoreFinish, formatChangesSummary, formatStepCompleted, formatStepFailed } from '../formatter'
import Prompts from '../prompts'
import { loadWorkspace, getWorkspaceTelemetryTags, updateWorkspace } from '../workspace/workspace'
import { getApprovedChanges } from '../callbacks'
import { createPublicCommandDef, CommandDefAction } from '../command_builder'
import { ServicesArg, SERVICES_OPTION, getAndValidateActiveServices } from './common/services'
import { EnvArg, ENVIORMENT_OPTION } from './common/env'

const log = logger(module)

const printRestorePlan = (changes: LocalChange[], detailed: boolean, output: CliOutput): void => {
  outputLine(EOL, output)
  outputLine(header(Prompts.RESTORE_CALC_DIFF_RESULT_HEADER), output)
  if (changes.length > 0) {
    outputLine(
      formatDetailedChanges([changes.map(change => change.change)], detailed),
      output,
    )
  } else {
    outputLine('No changes', output)
  }
  outputLine(EOL, output)
}

type RestoreArgs = {
    elementSelectors?: string[]
    force: boolean
    interactive: boolean
    dryRun: boolean
    detailedPlan: boolean
    listPlannedChanges: boolean
    mode: nacl.RoutingMode
} & ServicesArg & EnvArg

const applyLocalChangesToWorkspace = async (
  changes: LocalChange[],
  workspace: Workspace,
  workspaceTags: Tags,
  cliTelemetry: CliTelemetry,
  config: CommandConfig,
  output: CliOutput,
  mode: nacl.RoutingMode,
  force: boolean,
  interactive: boolean
): Promise<boolean> => {
  // If the workspace starts empty there is no point in showing a huge amount of changes
  const changesToApply = force || (await workspace.isEmpty())
    ? changes
    : await getApprovedChanges(changes, interactive)

  cliTelemetry.changesToApply(changesToApply.length, workspaceTags)
  outputLine(EOL, output)
  outputLine(
    formatStepStart(formatChangesSummary(changes.length, changesToApply.length)),
    output,
  )

  const success = await updateWorkspace({
    workspace,
    output,
    changes: changesToApply,
    mode,
    force,
  })
  if (success) {
    outputLine(formatStepCompleted(Prompts.RESTORE_UPDATE_WORKSPACE_SUCCESS), output)
    if (config.shouldCalcTotalSize) {
      const totalSize = await workspace.getTotalSize()
      log.debug(`Total size of the workspace is ${totalSize} bytes`)
      cliTelemetry.workspaceSize(totalSize, workspaceTags)
    }
    return true
  }
  outputLine(formatStepFailed(Prompts.RESTORE_UPDATE_WORKSPACE_FAIL), output)
  outputLine(EOL, output)
  return false
}

export const action: CommandDefAction<RestoreArgs> = async ({
  input,
  cliTelemetry,
  config,
  output,
  spinnerCreator,
  workspacePath = '.',
}): Promise<CliExitCode> => {
  log.debug('running restore command on \'%s\' %o', workspacePath, input)
  const {
    elementSelectors = [], force, interactive, dryRun,
    detailedPlan, listPlannedChanges, services, env, mode,
  } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelectors)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }
  const { workspace, errored } = await loadWorkspace(
    workspacePath,
    output,
    {
      force,
      printStateRecency: true,
      spinnerCreator,
      sessionEnv: env,
    }
  )
  if (errored) {
    cliTelemetry.failure()
    return CliExitCode.AppError
  }
  const actualServices = getAndValidateActiveServices(workspace, services)

  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)

  outputLine(EOL, output)
  outputLine(formatStepStart(Prompts.RESTORE_CALC_DIFF_START), output)

  const changes = await restore(workspace, actualServices, validSelectors)
  if (listPlannedChanges || dryRun) {
    printRestorePlan(changes, detailedPlan, output)
  }

  outputLine(formatStepStart(Prompts.RESTORE_CALC_DIFF_FINISH), output)
  outputLine(EOL, output)

  if (dryRun) {
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  }

  const updatingWsSucceeded = await applyLocalChangesToWorkspace(
    changes,
    workspace,
    workspaceTags,
    cliTelemetry,
    config,
    output,
    mode,
    force,
    interactive,
  )

  if (updatingWsSucceeded) {
    outputLine(formatRestoreFinish(), output)
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  }
  cliTelemetry.failure(workspaceTags)
  return CliExitCode.AppError
}

const restoreDef = createPublicCommandDef({
  properties: {
    name: 'restore',
    description: 'Restore configuration element(s) from the state file',
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
        description: 'Accept all incoming changes, even if there\'s a conflict with local changes',
        type: 'boolean',
      },
      {
        name: 'interactive',
        alias: 'i',
        required: false,
        description: 'Interactively approve every incoming change',
        type: 'boolean',
      },
      {
        name: 'dryRun',
        alias: 'd',
        description: 'Review the execution plan without deploying the changes',
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
      SERVICES_OPTION,
      ENVIORMENT_OPTION,
      {
        name: 'mode',
        alias: 'm',
        required: false,
        description: 'Choose a restore mode. Options - [align, override, isolated]',
        type: 'string',
        choices: ['isolated', 'default', 'align', 'override'],
        default: 'default',
      },
    ],
  },
  action,
})

export default restoreDef
