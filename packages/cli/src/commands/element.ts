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
import open from 'open'
import { ElemID, isElement, CORE_ANNOTATIONS, isModificationChange } from '@salto-io/adapter-api'
import {
  Workspace,
  ElementSelector,
  createElementSelectors,
  FromSource,
  selectElementIdsByTraversal,
  nacl,
  staticFiles,
} from '@salto-io/workspace'
import { parser } from '@salto-io/parser'
import { getEnvsDeletionsDiff, RenameElementIdError, rename, fixElements, SelectorsError } from '@salto-io/core'
import { logger } from '@salto-io/logging'
import { collections, promises } from '@salto-io/lowerdash'
import { createCommandGroupDef, createWorkspaceCommand, WorkspaceCommandAction } from '../command_builder'
import { CliOutput, CliExitCode, KeyedOption } from '../types'
import { errorOutputLine, outputLine } from '../outputer'
import {
  formatTargetEnvRequired,
  formatUnknownTargetEnv,
  formatInvalidEnvTargetCurrent,
  formatCloneToEnvFailed,
  formatInvalidFilters,
  formatMoveFailed,
  formatListFailed,
  emptyLine,
  formatListUnresolvedFound,
  formatListUnresolvedMissing,
  formatElementListUnresolvedFailed,
  formatChangeErrors,
  formatNonTopLevelSelectors,
} from '../formatter'
import { isValidWorkspaceForCommand } from '../workspace/workspace'
import Prompts from '../prompts'
import { EnvArg, ENVIRONMENT_OPTION, validateAndSetEnv } from './common/env'
import { getUserBooleanInput } from '../callbacks'

const { awu } = collections.asynciterable

const log = logger(module)

type CommonOrEnvs = 'common' | 'envs'

type AllowDeletionArg = {
  allowElementDeletions: boolean
}

const ALLOW_DELETIONS_OPTION: KeyedOption<AllowDeletionArg> = {
  name: 'allowElementDeletions',
  alias: 'd',
  default: false,
  type: 'boolean',
}

const validateEnvs = (output: CliOutput, workspace: Workspace, toEnvs: string[] = []): boolean => {
  if (toEnvs.length === 0) {
    errorOutputLine(formatTargetEnvRequired(), output)
    return false
  }
  const missingEnvs = toEnvs.filter(e => !workspace.envs().includes(e))
  if (!_.isEmpty(missingEnvs)) {
    errorOutputLine(formatUnknownTargetEnv(missingEnvs), output)
    return false
  }
  if (toEnvs.includes(workspace.currentEnv())) {
    errorOutputLine(formatInvalidEnvTargetCurrent(), output)
    return false
  }
  return true
}

const runElementsOperationMessages = async (
  nothingToDo: boolean,
  { stdout }: CliOutput,
  nothingToDoMessage: string,
  informationMessage: string,
  questionMessage: string,
  startMessage: string,
  force: boolean,
): Promise<boolean> => {
  if (nothingToDo) {
    stdout.write(nothingToDoMessage)
    return false
  }
  stdout.write(informationMessage)

  const shouldStart = force || (await getUserBooleanInput(questionMessage))
  if (shouldStart) {
    stdout.write(startMessage)
  }

  return shouldStart
}

const shouldMoveElements = async (
  to: string,
  elemIds: readonly ElemID[],
  elemIdsToRemove: Record<string, ElemID[]>,
  output: CliOutput,
  force: boolean,
): Promise<boolean> =>
  runElementsOperationMessages(
    elemIds.length === 0 && _.isEmpty(elemIdsToRemove),
    output,
    Prompts.NO_ELEMENTS_MESSAGE,
    [
      Prompts.MOVE_MESSAGE(
        to,
        elemIds.map(id => id.getFullName()),
      ),
      ...Object.entries(elemIdsToRemove).map(([envName, ids]) =>
        Prompts.ELEMENTS_DELETION_MESSAGE(
          envName,
          ids.map(id => id.getFullName()),
        ),
      ),
    ].join(''),
    Prompts.SHOULD_MOVE_QUESTION(to),
    Prompts.MOVE_START(to),
    force,
  )

const moveElement = async (
  workspace: Workspace,
  output: CliOutput,
  to: CommonOrEnvs,
  elmSelectors: ElementSelector[],
  cliOutput: CliOutput,
  force: boolean,
  allowElementDeletions = false,
): Promise<CliExitCode> => {
  try {
    const elemIds = await awu(
      await workspace.getElementIdsBySelectors(
        elmSelectors,
        to === 'envs' ? { source: 'common' } : { source: 'env' },
        true,
      ),
    ).toArray()

    const elemIdsToRemove = allowElementDeletions
      ? await getEnvsDeletionsDiff(
          workspace,
          elemIds,
          workspace.envs().filter(env => env !== workspace.currentEnv()),
          elmSelectors,
        )
      : {}

    if (!(await shouldMoveElements(to, elemIds, elemIdsToRemove, cliOutput, force))) {
      return CliExitCode.Success
    }

    if (to === 'common') {
      await workspace.promote(elemIds, elemIdsToRemove)
    } else if (to === 'envs') {
      await workspace.demote(elemIds)
    }
    await workspace.flush()
    return CliExitCode.Success
  } catch (e) {
    errorOutputLine(formatMoveFailed(e.message), output)
    return CliExitCode.AppError
  }
}

// Move to common
type ElementMoveToCommonArgs = {
  elementSelector: string[]
  force?: boolean
  allowElementDeletions: boolean
} & EnvArg

export const moveToCommonAction: WorkspaceCommandAction<ElementMoveToCommonArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { elementSelector, force, allowElementDeletions } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  await validateAndSetEnv(workspace, input, output)

  const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator, force })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  return moveElement(workspace, output, 'common', validSelectors, output, force ?? false, allowElementDeletions)
}

const moveToCommonDef = createWorkspaceCommand({
  properties: {
    name: 'move-to-common',
    description: 'Move env-specific configuration elements to the common configuration',
    positionalOptions: [
      {
        name: 'elementSelector',
        description: 'Array of config element patterns',
        type: 'stringsList',
        required: true,
      },
    ],
    keyedOptions: [
      ENVIRONMENT_OPTION,
      {
        name: 'force',
        alias: 'f',
        required: false,
        description: 'Do not prompt for confirmation during the move-to-common operation',
        type: 'boolean',
      },
      {
        ...ALLOW_DELETIONS_OPTION,
        description:
          'Delete all the elements in all the environments that match the selectors but do not exists in the source environment (to completely sync the environments)',
      },
    ],
  },
  action: moveToCommonAction,
})

// Move to envs
type ElementMoveToEnvsArgs = {
  elementSelector: string[]
  force?: boolean
  allowElementDeletions: boolean
}

export const moveToEnvsAction: WorkspaceCommandAction<ElementMoveToEnvsArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { elementSelector, force } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator, force })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }
  return moveElement(workspace, output, 'envs', validSelectors, output, force ?? false)
}

const moveToEnvsDef = createWorkspaceCommand({
  properties: {
    name: 'move-to-envs',
    description: 'Move common configuration elements to env-specific configurations',
    positionalOptions: [
      {
        name: 'elementSelector',
        description: 'Array of config element patterns',
        type: 'stringsList',
        required: true,
      },
    ],
    keyedOptions: [
      {
        name: 'force',
        alias: 'f',
        required: false,
        description: 'Do not prompt for confirmation during the move-to-envs operation',
        type: 'boolean',
      },
    ],
  },
  action: moveToEnvsAction,
})

const shouldCloneElements = async (
  targetEnvs: string[],
  elemIds: readonly ElemID[],
  elemIdsToRemove: Record<string, ElemID[]>,
  output: CliOutput,
  force: boolean,
): Promise<boolean> =>
  runElementsOperationMessages(
    elemIds.length === 0 && _.isEmpty(elemIdsToRemove),
    output,
    Prompts.NO_ELEMENTS_MESSAGE,
    [
      Prompts.CLONE_MESSAGE(elemIds.map(id => id.getFullName())),
      ...Object.entries(elemIdsToRemove).map(([envName, ids]) =>
        Prompts.ELEMENTS_DELETION_MESSAGE(
          envName,
          ids.map(id => id.getFullName()),
        ),
      ),
    ].join(''),
    Prompts.SHOULD_CLONE_QUESTION,
    Prompts.CLONE_TO_ENV_START(targetEnvs),
    force,
  )

// Clone
type ElementCloneArgs = {
  elementSelector: string[]
  toEnvs?: string[]
  toAllEnvs?: boolean
  force?: boolean
  allowElementDeletions: boolean
} & EnvArg

export const cloneAction: WorkspaceCommandAction<ElementCloneArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { toEnvs, toAllEnvs, env, elementSelector, force, allowElementDeletions } = input

  // Makes sure at least and only one of the env options is given
  if ((!toEnvs && !toAllEnvs) || (toEnvs && toAllEnvs)) {
    errorOutputLine(formatInvalidFilters([Prompts.CLONE_TARGET_ENV_ERROR]), output)
    return CliExitCode.UserInputError
  }

  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  const fromEnv = env ?? workspace.currentEnv()
  const envsToCloneTo = toEnvs || [...workspace.envs()].filter(e => e !== fromEnv)
  await validateAndSetEnv(workspace, input, output)
  if (!validateEnvs(output, workspace, envsToCloneTo)) {
    return CliExitCode.UserInputError
  }

  const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator, force })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  try {
    const sourceElemIds = await awu(
      await workspace.getElementIdsBySelectors(validSelectors, { source: 'env' }, true),
    ).toArray()

    const elemIdsToRemove = allowElementDeletions
      ? await getEnvsDeletionsDiff(workspace, sourceElemIds, envsToCloneTo, validSelectors)
      : {}

    if (!(await shouldCloneElements(envsToCloneTo, sourceElemIds, elemIdsToRemove, output, force ?? false))) {
      return CliExitCode.Success
    }

    await workspace.sync(sourceElemIds, elemIdsToRemove, envsToCloneTo)
    await workspace.flush()
    return CliExitCode.Success
  } catch (e) {
    errorOutputLine(formatCloneToEnvFailed(e.message), output)
    return CliExitCode.AppError
  }
}

const cloneDef = createWorkspaceCommand({
  properties: {
    name: 'clone',
    description: 'Clone elements from one env-specific configuration to others',
    positionalOptions: [
      {
        name: 'elementSelector',
        description: 'Array of config element patterns',
        type: 'stringsList',
        required: true,
      },
    ],
    keyedOptions: [
      ENVIRONMENT_OPTION,
      {
        name: 'toEnvs',
        description: 'The environment(s) to clone to',
        type: 'stringsList',
      },
      {
        name: 'toAllEnvs',
        description: 'Clone to all environments',
        type: 'boolean',
        alias: 'a',
      },
      // TODO: Check if needed
      {
        name: 'force',
        alias: 'f',
        required: false,
        description: 'Do not prompt for confirmation during the cloning operation',
        type: 'boolean',
      },
      {
        ...ALLOW_DELETIONS_OPTION,
        description:
          'Delete all the elements that match the selectors in the destination environments but do not exists in the source environment (to completely sync the environments)',
      },
    ],
  },
  action: cloneAction,
})

// List unresolved
type ElementListUnresolvedArgs = {
  completeFrom?: string
  force?: boolean
} & EnvArg

export const listUnresolvedAction: WorkspaceCommandAction<ElementListUnresolvedArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { completeFrom, force } = input
  await validateAndSetEnv(workspace, input, output)

  const validWorkspace = await isValidWorkspaceForCommand({
    workspace,
    cliOutput: output,
    spinnerCreator,
    force: force ?? false,
    ignoreUnresolvedRefs: true,
  })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  if (completeFrom !== undefined && !validateEnvs(output, workspace, [completeFrom])) {
    return CliExitCode.UserInputError
  }

  outputLine(Prompts.LIST_UNRESOLVED_START(workspace.currentEnv()), output)
  outputLine(emptyLine(), output)

  try {
    const { found, missing } = await workspace.listUnresolvedReferences(completeFrom)

    if (missing.length === 0 && found.length === 0) {
      outputLine(Prompts.LIST_UNRESOLVED_NONE(workspace.currentEnv()), output)
    } else {
      if (found.length > 0) {
        outputLine(formatListUnresolvedFound(completeFrom ?? '-', found), output)
      }
      if (missing.length > 0) {
        outputLine(formatListUnresolvedMissing(missing), output)
      }
    }

    return CliExitCode.Success
  } catch (e) {
    log.error(`Error listing elements: ${e}`)
    errorOutputLine(formatElementListUnresolvedFailed(e.message), output)
    return CliExitCode.AppError
  }
}

const listUnresolvedDef = createWorkspaceCommand({
  properties: {
    name: 'list-unresolved',
    description: 'Lists unresolved references to configuration elements',
    keyedOptions: [
      {
        name: 'completeFrom',
        alias: 'c',
        description: 'environment for completing missing references from (recursively)',
        type: 'string',
        required: false,
      },
      {
        name: 'force',
        alias: 'f',
        description: 'Do not ask for approval before listing unresolved references',
        type: 'boolean',
        required: false,
        default: false,
      },
      ENVIRONMENT_OPTION,
    ],
  },
  action: listUnresolvedAction,
})

// Open

type OpenActionArgs = {
  elementId: string
} & EnvArg

const safeGetElementId = (maybeElementIdPath: string, output: CliOutput): ElemID | undefined => {
  try {
    return ElemID.fromFullName(maybeElementIdPath)
  } catch (e) {
    errorOutputLine(e.message, output)
    return undefined
  }
}

export const openAction: WorkspaceCommandAction<OpenActionArgs> = async ({ input, output, workspace }) => {
  const { elementId } = input
  await validateAndSetEnv(workspace, input, output)

  const elemId = safeGetElementId(elementId, output)
  if (elemId === undefined) {
    return CliExitCode.UserInputError
  }

  const element = await workspace.getValue(elemId)
  if (element === undefined) {
    errorOutputLine(Prompts.NO_MATCHES_FOUND_FOR_ELEMENT(elementId), output)
    return CliExitCode.UserInputError
  }

  const serviceUrl = isElement(element) ? element.annotations[CORE_ANNOTATIONS.SERVICE_URL] : undefined
  if (serviceUrl === undefined) {
    errorOutputLine(Prompts.GO_TO_SERVICE_NOT_SUPPORTED_FOR_ELEMENT(elementId), output)
    return CliExitCode.AppError
  }

  await open(serviceUrl)
  return CliExitCode.Success
}

const elementOpenDef = createWorkspaceCommand({
  properties: {
    name: 'open',
    description: 'Opens the service page of an element',
    keyedOptions: [ENVIRONMENT_OPTION],
    positionalOptions: [
      {
        name: 'elementId',
        type: 'string',
        description: 'an Element ID',
        required: true,
      },
    ],
  },
  action: openAction,
})

type ElementListArgs = {
  elementSelector: string[]
  mode: FromSource
} & EnvArg

const listElements = async (
  workspace: Workspace,
  output: CliOutput,
  mode: FromSource,
  elmSelectors: ElementSelector[],
): Promise<CliExitCode> => {
  const elemIds = await awu(await workspace.getElementIdsBySelectors(elmSelectors, { source: mode }, true)).toArray()

  output.stdout.write(Prompts.LIST_MESSAGE(elemIds.map(id => id.getFullName())))
  return CliExitCode.Success
}

export const listAction: WorkspaceCommandAction<ElementListArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}) => {
  try {
    const { elementSelector, mode } = input
    const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
    if (!_.isEmpty(invalidSelectors)) {
      errorOutputLine(formatInvalidFilters(invalidSelectors), output)
      return CliExitCode.UserInputError
    }

    await validateAndSetEnv(workspace, input, output)

    const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator })
    if (!validWorkspace) {
      return CliExitCode.AppError
    }
    return await listElements(workspace, output, mode, validSelectors)
  } catch (e) {
    errorOutputLine(formatListFailed(e.message), output)
    return CliExitCode.AppError
  }
}

const listElementsDef = createWorkspaceCommand({
  properties: {
    name: 'list',
    description: 'List elements by selector(s) definition',
    positionalOptions: [
      {
        name: 'elementSelector',
        description: 'Array of config element patterns',
        type: 'stringsList',
        required: true,
      },
    ],
    keyedOptions: [
      ENVIRONMENT_OPTION,
      {
        name: 'mode',
        alias: 'm',
        required: false,
        description: 'Choose a list mode. Options - [all, common, env]',
        type: 'string',
        choices: ['all', 'common', 'env'],
        default: 'all',
      },
    ],
  },
  action: listAction,
})

type ElementRenameArgs = {
  sourceElementId: string
  targetElementId: string
} & EnvArg

export const renameAction: WorkspaceCommandAction<ElementRenameArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}) => {
  const { sourceElementId, targetElementId } = input

  await validateAndSetEnv(workspace, input, output)

  const validWorkspace = await isValidWorkspaceForCommand({ workspace, cliOutput: output, spinnerCreator })
  if (!validWorkspace) {
    return CliExitCode.AppError
  }
  outputLine(emptyLine(), output)

  const sourceElemId = safeGetElementId(sourceElementId, output)
  const targetElemId = safeGetElementId(targetElementId, output)
  if (sourceElemId === undefined || targetElemId === undefined) {
    return CliExitCode.UserInputError
  }

  try {
    const changes = await rename(workspace, sourceElemId, targetElemId)
    await workspace.updateNaclFiles(changes)
    await workspace.flush()

    outputLine(Prompts.RENAME_ELEMENT(sourceElemId.getFullName(), targetElemId.getFullName()), output)

    outputLine(
      Prompts.RENAME_ELEMENT_REFERENCES(sourceElemId.getFullName(), changes.filter(isModificationChange).length),
      output,
    )
  } catch (error) {
    if (error instanceof RenameElementIdError) {
      errorOutputLine(error.message, output)
      return CliExitCode.UserInputError
    }
    throw error
  }
  return CliExitCode.Success
}

const renameElementsDef = createWorkspaceCommand({
  properties: {
    name: 'rename',
    description: 'Rename an element (currently supporting InstanceElement only)',
    positionalOptions: [
      {
        name: 'sourceElementId',
        description: 'Element ID to rename',
        type: 'string',
        required: true,
      },
      {
        name: 'targetElementId',
        description: 'New Element ID',
        type: 'string',
        required: true,
      },
    ],
    keyedOptions: [ENVIRONMENT_OPTION],
  },
  action: renameAction,
})

type PrintElementArgs = {
  selectors: string[]
  source: 'nacl' | 'state'
  onlyValue: boolean
} & EnvArg
export const printElementAction: WorkspaceCommandAction<PrintElementArgs> = async ({ workspace, input, output }) => {
  const { validSelectors, invalidSelectors } = createElementSelectors(input.selectors)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  await validateAndSetEnv(workspace, input, output)
  const elementSource = input.source === 'nacl' ? await workspace.elements() : workspace.state()

  const relevantIds = await selectElementIdsByTraversal({
    selectors: validSelectors,
    source: elementSource,
    referenceSourcesIndex: await workspace.getReferenceSourcesIndex(),
  })

  await awu(relevantIds).forEach(async id => {
    const value = await elementSource.get(id)
    // We build a new static files source each time to avoid having to keep
    // all the static files loaded in memory
    const functions = nacl.getFunctions(staticFiles.buildInMemStaticFilesSource())
    const dumpedValue = isElement(value)
      ? await parser.dumpElements([value], functions)
      : await parser.dumpValues(value, functions)
    const outputStr = input.onlyValue ? dumpedValue : `${id.getFullName()}: ${dumpedValue}`
    outputLine(outputStr, output)
  })
  return CliExitCode.Success
}

const printElementDef = createWorkspaceCommand({
  properties: {
    name: 'print',
    description: 'Print the value of element / part of an element',
    keyedOptions: [
      {
        name: 'source',
        alias: 's',
        type: 'string',
        choices: ['nacl', 'state'],
        default: 'nacl',
        description: 'Print element as it is in the nacl or the state',
      },
      {
        name: 'onlyValue',
        alias: 'o',
        type: 'boolean',
        default: false,
        description: 'Print only matching values without their ID',
      },
      ENVIRONMENT_OPTION,
    ],
    positionalOptions: [
      {
        name: 'selectors',
        type: 'stringsList',
        required: true,
      },
    ],
  },
  action: printElementAction,
})

type FixElementsArgs = {
  selectors: string[]
} & EnvArg

export const fixElementsAction: WorkspaceCommandAction<FixElementsArgs> = async ({ workspace, input, output }) => {
  const { validSelectors, invalidSelectors } = createElementSelectors(input.selectors)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  await validateAndSetEnv(workspace, input, output)

  try {
    const { changes, errors } = await fixElements(workspace, validSelectors)

    if (changes.length === 0) {
      outputLine(Prompts.EMPTY_PLAN, output)
      return CliExitCode.Success
    }

    const changeErrors = await promises.array.withLimitedConcurrency(
      errors.map(error => () => workspace.transformToWorkspaceError(error)),
      20,
    )

    outputLine(formatChangeErrors(changeErrors), output)

    await workspace.updateNaclFiles(changes)
    await workspace.flush()

    return CliExitCode.Success
  } catch (err) {
    if (err instanceof SelectorsError) {
      errorOutputLine(formatNonTopLevelSelectors(err.invalidSelectors), output)
      return CliExitCode.UserInputError
    }
    throw err
  }
}

const fixElementsDef = createWorkspaceCommand({
  properties: {
    name: 'fix',
    description: 'Apply a set of service specific fixes to the NaCls in the workspace',
    keyedOptions: [ENVIRONMENT_OPTION],
    positionalOptions: [
      {
        name: 'selectors',
        type: 'stringsList',
        required: true,
      },
    ],
  },
  action: fixElementsAction,
})

const elementGroupDef = createCommandGroupDef({
  properties: {
    name: 'element',
    description: 'Manage the workspace configuration elements',
  },
  subCommands: [
    moveToCommonDef,
    moveToEnvsDef,
    cloneDef,
    listUnresolvedDef,
    elementOpenDef,
    listElementsDef,
    renameElementsDef,
    printElementDef,
    fixElementsDef,
  ],
})

export default elementGroupDef
