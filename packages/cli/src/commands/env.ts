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
import { isObjectType, ObjectType, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { EOL } from 'os'
import { diff, localWorkspaceConfigSource, createEnvironmentSource, loadLocalWorkspace } from '@salto-io/core'
import { Workspace, createElementSelectors, remoteMap as rm, EnvironmentSource, ElementsSource } from '@salto-io/workspace'
import { CommandDefAction, createCommandGroupDef, createPublicCommandDef, createWorkspaceCommand, WorkspaceCommandAction } from '../command_builder'
import { CliOutput, CliExitCode } from '../types'
import {
  formatEnvListItem, formatCurrentEnv, formatCreateEnv, formatSetEnv, formatDeleteEnv,
  formatRenameEnv, formatApproveIsolateCurrentEnvPrompt, formatDoneIsolatingCurrentEnv,
  formatInvalidFilters, formatStepStart, formatStepCompleted, formatEnvDiff,
} from '../formatter'
import Prompts from '../prompts'
import { cliApproveIsolateBeforeMultiEnv } from '../callbacks'
import { outputLine, errorOutputLine } from '../outputer'
import { AccountsArg, ACCOUNTS_OPTION, getAndValidateActiveAccounts } from './common/accounts'
import { ConfigOverrideArg, CONFIG_OVERRIDE_OPTION, getConfigOverrideChanges } from './common/config_override'
import { getWorkspaceTelemetryTags } from '../workspace/workspace'

const { awu } = collections.asynciterable

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
): Promise<boolean> => {
  const envNames = workspace.envs()
  return (
    envNames.length === 1
    && !await workspace.isEmpty(true)
    && !await workspace.hasElementsInEnv(envNames[0])
  )
}

const isolateExistingEnvironments = async (workspace: Workspace): Promise<void> => {
  await workspace.demoteAll()
  await workspace.flush()
}

const maybeIsolateExistingEnv = async (
  output: CliOutput,
  workspace: Workspace,
  force?: boolean,
  acceptSuggestions?: boolean,
): Promise<void> => {
  if (
    (!force || acceptSuggestions)
    && await shouldRecommendToIsolateCurrentEnv(workspace)
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
} & AccountsArg

export const diffAction: WorkspaceCommandAction<EnvDiffArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { detailedPlan, elementSelector = [], hidden, state, fromEnv, toEnv, accounts } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }
  const actualAccounts = getAndValidateActiveAccounts(workspace, accounts)
  if (!(workspace.envs().includes(fromEnv))) {
    errorOutputLine(`Unknown environment ${fromEnv}`, output)
    return CliExitCode.UserInputError
  }
  if (!(workspace.envs().includes(toEnv))) {
    errorOutputLine(`Unknown environment ${toEnv}`, output)
    return CliExitCode.UserInputError
  }
  outputLine(EOL, output)
  outputLine(formatStepStart(Prompts.DIFF_CALC_DIFF_START(toEnv, fromEnv)), output)

  const changes = await diff(
    workspace,
    fromEnv,
    toEnv,
    hidden,
    state,
    actualAccounts,
    validSelectors,
  )
  outputLine(await formatEnvDiff(changes, detailedPlan, toEnv, fromEnv), output)
  outputLine(formatStepCompleted(Prompts.DIFF_CALC_DIFF_FINISH(toEnv, fromEnv)), output)
  outputLine(EOL, output)

  return CliExitCode.Success
}

const envDiffDef = createWorkspaceCommand({
  properties: {
    name: 'diff',
    description: 'Compare two workspace environments',
    positionalOptions: [
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
    keyedOptions: [
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
      ACCOUNTS_OPTION,
    ],
  },
  action: diffAction,
})

// Delete
type sfProfilesInfoArgs = {
  envName?: string
}

const RELEVANT_METADATA_TYPES = [
  'ApexClass',
  'ApexPage',
  'FlowDefinition',
  'ExternalDataSource',
  'CustomPermission',
  'CustomApplication',
  'Layout',
  'RecordType',
  'InstalledPackage',
]

const CUSTOM_SUFFIX = '__c'
const NAMESPACE_SEPARATOR = '__'

const getInstancesCounts = async (
  salesforceElements: InstanceElement[],
  elementsSource: ElementsSource,
): Promise<Record<string, number>> =>
  (Object.fromEntries((await awu(RELEVANT_METADATA_TYPES).map(async metadataType => (
    {
      type: metadataType,
      count: (await awu(salesforceElements).filter(async e =>
        (await e.getType(elementsSource)).annotations.metadataType === metadataType)
        .toArray()).length,
    }
  )).toArray()).map(tC => [tC.type, tC.count])))

const sfProfilesInfoAction: WorkspaceCommandAction<sfProfilesInfoArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { envName } = input
  if (envName !== undefined && !(workspace.envs().includes(envName))) {
    errorOutputLine(`Unknown environment ${envName}`, output)
    return CliExitCode.UserInputError
  }
  try {
    const elementsSource = await workspace.elements(false, envName ?? workspace.currentEnv())
    const sfElements = await awu(await elementsSource.getAll())
      .filter(e => e.elemID.adapter === 'salesforce')
      .toArray()
    const customObjects = sfElements.filter(e =>
      isObjectType(e)
      && e.annotations.metadataType === 'CustomObject'
      && e.annotations.apiName !== undefined)
    const [custom, standard] = _.partition(
      customObjects,
      e => e.annotations.apiName.endsWith(CUSTOM_SUFFIX),
    )
    const customObjectFields = (custom as ObjectType[]).flatMap(c =>
      Object.values(c.fields))
    const [coCustomFields, coStandardFields] = _.partition(
      customObjectFields,
      f => f.name.endsWith(CUSTOM_SUFFIX),
    )
    const [namespacedCoCustomFields, nonNamespacedCoCustomFields] = _.partition(
      coCustomFields,
      f => f.name.split(NAMESPACE_SEPARATOR).length === 3,
    )
    const standardObjectFields = (standard as ObjectType[]).flatMap(s =>
      Object.values(s.fields))
    const [soCustomFields, soStandardFields] = _.partition(
      standardObjectFields,
      f => f.name.endsWith(CUSTOM_SUFFIX),
    )
    const [namespacedSoCustomFields, nonNamespacedSoCustomFields] = _.partition(
      soCustomFields,
      f => f.name.split(NAMESPACE_SEPARATOR).length === 3,
    )
    const instances = sfElements.filter(e => isInstanceElement(e)) as InstanceElement[]
    const summary = {
      ...(await getInstancesCounts(instances, elementsSource)),
      customObjects: {
        objects: custom.length,
        standardFields: coStandardFields.length,
        packageCustomFields: namespacedCoCustomFields.length,
        userCustomFields: nonNamespacedCoCustomFields.length,
      },
      standardObjects: {
        objects: standard.length,
        standardFields: soStandardFields.length,
        packageCustomFields: namespacedSoCustomFields.length,
        userCustomFields: nonNamespacedSoCustomFields.length,
      },
    }
    outputLine(
      safeJsonStringify(
        summary,
        undefined,
        2
      ),
      output,
    )
  } catch (error) {
    outputLine(
      error.message,
      output,
    )
  }
  return CliExitCode.Success
}

const envSfProfilesInfoDef = createWorkspaceCommand({
  properties: {
    name: 'sfProfilesInfo',
    description: 'Information about Salesforce that helps with understanding Profiles',
    keyedOptions: [],
    positionalOptions: [
      {
        name: 'envName',
        required: false,
        description: 'The environment name',
        type: 'string',
      },
    ],
  },
  action: sfProfilesInfoAction,
})

// Rename
type EnvRenameArgs = {
  oldName: string
  newName: string
}

export const renameAction: WorkspaceCommandAction<EnvRenameArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { oldName, newName } = input
  await workspace.renameEnvironment(oldName, newName)
  outputLine(formatRenameEnv(oldName, newName), output)
  return CliExitCode.Success
}

const envRenameDef = createWorkspaceCommand({
  properties: {
    name: 'rename',
    description: 'Rename a workspace environment',
    positionalOptions: [
      {
        name: 'oldName',
        required: true,
        description: 'The current environment name',
        type: 'string',
      },
      {
        name: 'newName',
        required: true,
        description: 'The new environment name',
        type: 'string',
      },
    ],
  },
  action: renameAction,
})

// Delete
type EnvDeleteArgs = {
  envName: string
  keepNacls?: boolean
}

export const deleteAction: WorkspaceCommandAction<EnvDeleteArgs> = async (
  { input, output, workspace },
): Promise<CliExitCode> => {
  const { envName, keepNacls } = input
  await workspace.deleteEnvironment(envName, keepNacls)
  outputLine(formatDeleteEnv(envName), output)
  return CliExitCode.Success
}

const envDeleteDef = createWorkspaceCommand({
  properties: {
    name: 'delete',
    description: 'Delete a workspace environment',
    keyedOptions: [
      {
        name: 'keepNacls',
        alias: 'k',
        description: 'Do not delete nacl and state files',
        type: 'boolean',
      },
    ],
    positionalOptions: [
      {
        name: 'envName',
        required: true,
        description: 'The environment name',
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

export const setAction: WorkspaceCommandAction<EnvSetArgs> = async (
  { input: { envName }, output, workspace },
): Promise<CliExitCode> => (
  setEnvironment(envName, output, workspace)
)

const envSetDef = createWorkspaceCommand({
  properties: {
    name: 'set',
    description: 'Set a new current workspace environment',
    positionalOptions: [
      {
        name: 'envName',
        required: true,
        description: 'The environment name',
        type: 'string',
      },
    ],
  },
  action: setAction,
})

// Current
type EnvCurrentArgs = {}

export const currentAction: WorkspaceCommandAction<EnvCurrentArgs> = async (
  { output, workspace },
): Promise<CliExitCode> => {
  outputLine(formatCurrentEnv(workspace.currentEnv()), output)
  return CliExitCode.Success
}

const envCurrentDef = createWorkspaceCommand({
  properties: {
    name: 'current',
    description: 'Print the name of the current workspace environment',
  },
  action: currentAction,
})

// List
type EnvListArgs = {}

export const listAction: WorkspaceCommandAction<EnvListArgs> = async (
  { output, workspace },
): Promise<CliExitCode> => {
  const list = formatEnvListItem(workspace.envs(), workspace.currentEnv())
  outputLine(list, output)
  return CliExitCode.Success
}

const envListDef = createWorkspaceCommand({
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

export const createAction: CommandDefAction<EnvCreateArgs & ConfigOverrideArg> = async (args):
Promise<CliExitCode> => {
  // Note: Some of the code here is copied from createWorkspaceCommand.
  // We do it since we need the workspace config in order to create the environment source
  const { force, yesAll, envName } = args.input
  const configOverrides = getConfigOverrideChanges(args.input)
  const workspace = await loadLocalWorkspace({
    path: args.workspacePath,
    configOverrides,
  })
  args.cliTelemetry.setTags(getWorkspaceTelemetryTags(workspace))
  args.cliTelemetry.start()

  try {
    await maybeIsolateExistingEnv(args.output, workspace, force, yesAll)
    const workspaceConfig = await localWorkspaceConfigSource(args.workspacePath)
    const rmcToEnvSource = async (remoteMapCreator: rm.RemoteMapCreator):
    Promise<EnvironmentSource> =>
      createEnvironmentSource({
        env: envName,
        baseDir: args.workspacePath,
        localStorage: workspaceConfig.localStorage,
        remoteMapCreator,
        persistent: true,
      })
    await workspace.addEnvironment(envName, rmcToEnvSource)
    await setEnvironment(envName, args.output, workspace)
    outputLine(formatCreateEnv(envName), args.output)
    args.cliTelemetry.success()
    return CliExitCode.Success
  } catch (e) {
    args.cliTelemetry.failure()
    return CliExitCode.AppError
  }
}

const envCreateDef = createPublicCommandDef({
  properties: {
    name: 'create',
    description: 'Create a new environment in the workspace',
    keyedOptions: [
      CONFIG_OVERRIDE_OPTION,
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
    positionalOptions: [
      {
        name: 'envName',
        required: true,
        description: 'The new environment name',
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
    envSfProfilesInfoDef,
  ],
})

export default envGroupDef
