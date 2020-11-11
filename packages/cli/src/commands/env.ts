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
import { logger } from '@salto-io/logging'
import { EOL } from 'os'
import { loadLocalWorkspace, envFolderExists, diff } from '@salto-io/core'
import { Workspace, createElementSelectors } from '@salto-io/workspace'
import { createCommandGroupDef, createPublicCommandDef, DefActionInput } from '../command_builder'
import { CliOutput, CliExitCode } from '../types'
import {
  formatEnvListItem, formatCurrentEnv, formatCreateEnv, formatSetEnv, formatDeleteEnv,
  formatRenameEnv, formatApproveIsolateCurrentEnvPrompt, formatDoneIsolatingCurrentEnv,
  formatInvalidFilters, formatStepStart, formatStepCompleted, formatEnvDiff,
} from '../formatter'
import Prompts from '../prompts'
import { getWorkspaceTelemetryTags } from '../workspace/workspace'
import { cliApproveIsolateBeforeMultiEnv } from '../callbacks'
import { outputLine, errorOutputLine } from '../outputer'
import { ServicesArg, SERVICES_OPTION, getAndValidateActiveServices } from './commons/services'

const log = logger(module)

const setEnvironment = async (
  envName: string,
  output: CliOutput,
  workspace: Workspace,
): Promise<CliExitCode> => {
  await workspace.setCurrentEnv(envName)
  outputLine(formatSetEnv(envName), output)
  return CliExitCode.Success
}

const shouldRecommendToIsolateCurrentEnv = async (
  workspace: Workspace,
  workspaceDir: string,
): Promise<boolean> => {
  const envNames = workspace.envs()
  return (
    envNames.length === 1
    && !await workspace.isEmpty(true)
    && !await envFolderExists(workspaceDir, envNames[0])
  )
}

const isolateExistingEnvironments = async (workspace: Workspace): Promise<void> => {
  await workspace.demoteAll()
  await workspace.flush()
}

const maybeIsolateExistingEnv = async (
  output: CliOutput,
  workspace: Workspace,
  workspaceDir: string,
  force?: boolean,
  acceptSuggestions?: boolean,
): Promise<void> => {
  if (
    (!force || acceptSuggestions)
    && await shouldRecommendToIsolateCurrentEnv(workspace, workspaceDir)
  ) {
    const existingEnv = workspace.envs()[0]
    outputLine(formatApproveIsolateCurrentEnvPrompt(existingEnv), output)
    if (acceptSuggestions || await cliApproveIsolateBeforeMultiEnv(existingEnv)) {
      await isolateExistingEnvironments(workspace)
      outputLine(formatDoneIsolatingCurrentEnv(existingEnv), output)
    }
  }
}

// Diff
type EnvDiffArgs = {
    fromEnv: string
    toEnv: string
    elementSelector?: string[]
    detailedPlan: boolean
    hidden: boolean
    state: boolean
} & ServicesArg

export const diffAction = async (
  {
    input: { detailedPlan, elementSelector = [], hidden, state, fromEnv, toEnv, services },
    output,
    cliTelemetry,
    workingDir = '.',
  }: DefActionInput<EnvDiffArgs>): Promise<CliExitCode> => {
  log.debug(`running diff command on '${workingDir}', detailedPlan=${detailedPlan}
        , services=${services}, fromEnv=${fromEnv}, toEnv=${toEnv}
        , inputHidden=${hidden}, inputState=${state}, elmSelectors=${elementSelector}`)

  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }
  const workspace = await loadLocalWorkspace(workingDir)
  const actualServices = getAndValidateActiveServices(workspace, services)
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  if (!(workspace.envs().includes(fromEnv))) {
    errorOutputLine(`Unknown environment ${fromEnv}`, output)
    return CliExitCode.UserInputError
  }
  if (!(workspace.envs().includes(toEnv))) {
    errorOutputLine(`Unknown environment ${toEnv}`, output)
    return CliExitCode.UserInputError
  }
  cliTelemetry.start(workspaceTags)
  outputLine(EOL, output)
  outputLine(formatStepStart(Prompts.DIFF_CALC_DIFF_START(toEnv, fromEnv)), output)

  const changes = await diff(
    workspace,
    fromEnv,
    toEnv,
    hidden,
    state,
    actualServices,
    validSelectors,
  )
  outputLine(formatEnvDiff(changes, detailedPlan, toEnv, fromEnv), output)
  outputLine(formatStepCompleted(Prompts.DIFF_CALC_DIFF_FINISH(toEnv, fromEnv)), output)
  outputLine(EOL, output)
  cliTelemetry.success(workspaceTags)

  return CliExitCode.Success
}

const envDiffDef = createPublicCommandDef({
  properties: {
    name: 'diff',
    description: 'Compare two workspace environments',
    positionals: [
      {
        name: 'fromEnv',
        type: 'string',
        required: true,
        description: 'The environment that serves as a baseline for the comparison',
      },
      {
        name: 'toEnv',
        type: 'string',
        required: true,
        description: 'The environment that is compared to the baseline provided by from-env',
      },
      {
        name: 'elementSelector',
        type: 'stringsList',
        required: false,
        description: 'Array of configuration element patterns',
      },
    ],
    options: [
      {
        name: 'detailedPlan',
        alias: 'p',
        type: 'boolean',
        required: false,
        description: 'Print detailed changes between envs',
      },
      {
        name: 'hidden',
        alias: 'hd',
        type: 'boolean',
        required: false,
        description: 'Display changes in hidden values',
      },
      {
        name: 'state',
        type: 'boolean',
        required: false,
        description: 'Use the latest state files to compare the environments',
      },
      SERVICES_OPTION,
    ],
  },
  action: diffAction,
})

// Rename
type EnvRenameArgs = {
    oldName: string
    newName: string
}

export const renameAction = async (
  {
    input: { oldName, newName },
    output,
    workingDir = '.',
  }: DefActionInput<EnvRenameArgs>,
): Promise<CliExitCode> => {
  const workspace = await loadLocalWorkspace(workingDir)
  await workspace.renameEnvironment(oldName, newName)
  outputLine(formatRenameEnv(oldName, newName), output)
  return CliExitCode.Success
}

const envRenameDef = createPublicCommandDef({
  properties: {
    name: 'rename',
    description: 'Rename an environment',
    positionals: [
      {
        name: 'oldName',
        required: true,
        description: 'The current enviorment name',
        type: 'string',
      },
      {
        name: 'newName',
        required: true,
        description: 'The new enviorment name',
        type: 'string',
      },
    ],
  },
  action: renameAction,
})

// Delete
type EnvDeleteArgs = {
    envName: string
}

export const deleteAction = async (
  { input: { envName }, output, workingDir = '.' }: DefActionInput<EnvDeleteArgs>,
): Promise<CliExitCode> => {
  const workspace = await loadLocalWorkspace(workingDir)
  await workspace.deleteEnvironment(envName)
  outputLine(formatDeleteEnv(envName), output)
  return CliExitCode.Success
}

const envDeleteDef = createPublicCommandDef({
  properties: {
    name: 'delete',
    description: 'Delete a workspace environment',
    positionals: [
      {
        name: 'envName',
        required: true,
        description: 'The enviorment name',
        type: 'string',
      },
    ],
  },
  action: deleteAction,
})

// Set
type EnvSetArgs = {
    envName: string
}

export const setAction = async (
  { input: { envName }, output, workingDir = '.' }: DefActionInput<EnvSetArgs>,
): Promise<CliExitCode> => {
  const workspace = await loadLocalWorkspace(workingDir)
  return setEnvironment(envName, output, workspace)
}

const envSetDef = createPublicCommandDef({
  properties: {
    name: 'set',
    description: 'Set a new current workspace environment',
    positionals: [
      {
        name: 'envName',
        required: true,
        description: 'The enviorment name',
        type: 'string',
      },
    ],
  },
  action: setAction,
})

// Current
type EnvCurrentArgs = {}

export const currentAction = async (
  { output, workingDir = '.' }: DefActionInput<EnvCurrentArgs>,
): Promise<CliExitCode> => {
  const workspace = await loadLocalWorkspace(workingDir)
  outputLine(formatCurrentEnv(workspace.currentEnv()), output)
  return CliExitCode.Success
}

const envCurrentDef = createPublicCommandDef({
  properties: {
    name: 'current',
    description: 'Print the name of the current workspace environment',
  },
  action: currentAction,
})

// List
type EnvListArgs = {}

const listAction = async (
  { output, workingDir = '.' }: DefActionInput<EnvListArgs>
): Promise<CliExitCode> => {
  const workspace = await loadLocalWorkspace(workingDir)
  const list = formatEnvListItem(workspace.envs(), workspace.currentEnv())
  outputLine(list, output)
  return CliExitCode.Success
}

const envListDef = createPublicCommandDef({
  properties: {
    name: 'list',
    description: 'List all workspace environments',
  },
  action: listAction,
})

// Create
type EnvCreateArgs = {
    envName: string
    force?: boolean
    yesAll?: boolean
}

export const createAction = async (
  {
    input: { force, yesAll, envName },
    output,
    workingDir = '.',
  }: DefActionInput<EnvCreateArgs>,
): Promise<CliExitCode> => {
  const workspace = await loadLocalWorkspace(workingDir)
  await maybeIsolateExistingEnv(output, workspace, workingDir, force, yesAll)

  await workspace.addEnvironment(envName)
  await setEnvironment(envName, output, workspace)
  outputLine(formatCreateEnv(envName), output)
  return CliExitCode.Success
}

const envCreateDef = createPublicCommandDef({
  properties: {
    name: 'create',
    description: 'Create a new environemnt in the workspace',
    options: [
      {
        name: 'force',
        alias: 'f',
        description: 'Force action even if there are errors',
        type: 'boolean',
      },
      {
        name: 'yesAll',
        alias: 'y',
        description: 'Accept all correction suggestions without prompting',
        type: 'boolean',
      },
    ],
    positionals: [
      {
        name: 'envName',
        required: true,
        description: 'The new enviorment name',
        type: 'string',
      },
    ],
  },
  action: createAction,
})

// Group definition
const envGroupDef = createCommandGroupDef({
  properties: {
    name: 'env',
    description: 'Manage the workspace environments',
  },
  subCommands: [
    envCreateDef,
    envListDef,
    envCurrentDef,
    envSetDef,
    envDeleteDef,
    envRenameDef,
    envDiffDef,
  ],
})

export default envGroupDef
