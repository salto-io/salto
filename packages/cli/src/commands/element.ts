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
import open from 'open'
import { ElemID, isElement, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { listUnresolvedReferences } from '@salto-io/core'
import { Workspace, ElementSelector, createElementSelectors } from '@salto-io/workspace'
import { logger } from '@salto-io/logging'
import { createCommandGroupDef, createWorkspaceCommand, WorkspaceCommandAction } from '../command_builder'
import { CliOutput, CliExitCode } from '../types'
import { errorOutputLine, outputLine } from '../outputer'
import { formatTargetEnvRequired, formatUnknownTargetEnv, formatInvalidEnvTargetCurrent, formatCloneToEnvFailed, formatInvalidFilters, formatMoveFailed, emptyLine, formatListUnresolvedFound, formatListUnresolvedMissing, formatElementListUnresolvedFailed } from '../formatter'
import { isValidWorkspaceForCommand } from '../workspace/workspace'
import Prompts from '../prompts'
import { EnvArg, ENVIRONMENT_OPTION, validateAndSetEnv } from './common/env'

const log = logger(module)

type CommonOrEnvs = 'common' | 'envs'

const validateEnvs = (
  output: CliOutput,
  workspace: Workspace,
  toEnvs: string[] = [],
): boolean => {
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

const moveElement = async (
  workspace: Workspace,
  output: CliOutput,
  to: CommonOrEnvs,
  elmSelectors: ElementSelector[],
): Promise<CliExitCode> => {
  try {
    if (to === 'common') {
      outputLine(Prompts.MOVE_START('common'), output)
      await workspace.promote(await workspace.getElementIdsBySelectors(elmSelectors))
    } else if (to === 'envs') {
      outputLine(Prompts.MOVE_START('environment-specific folders'), output)
      await workspace.demote(await workspace.getElementIdsBySelectors(elmSelectors, true))
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
} & EnvArg

export const moveToCommonAction: WorkspaceCommandAction<ElementMoveToCommonArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { elementSelector } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  await validateAndSetEnv(workspace, input, output)

  const validWorkspace = await isValidWorkspaceForCommand(
    { workspace, cliOutput: output, spinnerCreator, force: false }
  )
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  return moveElement(workspace, output, 'common', validSelectors)
}

const moveToCommonDef = createWorkspaceCommand({
  properties: {
    name: 'move-to-common',
    description: 'Move configuration elements to the common configuration',
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
    ],
  },
  action: moveToCommonAction,
})

// Move to envs
type ElementMoveToEnvsArgs = {
  elementSelector: string[]
}

export const moveToEnvsAction: WorkspaceCommandAction<ElementMoveToEnvsArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { elementSelector } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }

  const validWorkspace = await isValidWorkspaceForCommand(
    { workspace, cliOutput: output, spinnerCreator, force: false }
  )
  if (!validWorkspace) {
    return CliExitCode.AppError
  }
  return moveElement(workspace, output, 'envs', validSelectors)
}

const moveToEnvsDef = createWorkspaceCommand({
  properties: {
    name: 'move-to-envs',
    description: 'Move configuration elements to the env-specific configuration',
    positionalOptions: [
      {
        name: 'elementSelector',
        description: 'Array of config element patterns',
        type: 'stringsList',
        required: true,
      },
    ],
  },
  action: moveToEnvsAction,
})

// Clone
type ElementCloneArgs = {
  elementSelector: string[]
  toEnvs: string[]
  force?: boolean
} & EnvArg

export const cloneAction: WorkspaceCommandAction<ElementCloneArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { toEnvs, elementSelector, force } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }
  await validateAndSetEnv(workspace, input, output)
  if (!validateEnvs(output, workspace, toEnvs)) {
    return CliExitCode.UserInputError
  }

  const validWorkspace = await isValidWorkspaceForCommand(
    { workspace, cliOutput: output, spinnerCreator, force }
  )
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  try {
    outputLine(Prompts.CLONE_TO_ENV_START(toEnvs), output)
    await workspace.copyTo(await workspace.getElementIdsBySelectors(validSelectors), toEnvs)
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
      {
        name: 'toEnvs',
        description: 'The environment(s) to clone to',
        type: 'stringsList',
        required: true,
      },
      ENVIRONMENT_OPTION,
      // TODO: Check if needed
      {
        name: 'force',
        alias: 'f',
        required: false,
        description: 'Apply even if workspace has issues',
        type: 'boolean',
      },
    ],
  },
  action: cloneAction,
})

// List unresolved
type ElementListUnresolvedArgs = {
  completeFrom?: string
} & EnvArg

export const listUnresolvedAction: WorkspaceCommandAction<ElementListUnresolvedArgs> = async ({
  input,
  output,
  spinnerCreator,
  workspace,
}): Promise<CliExitCode> => {
  const { completeFrom } = input
  await validateAndSetEnv(workspace, input, output)

  const validWorkspace = await isValidWorkspaceForCommand(
    { workspace, cliOutput: output, spinnerCreator, force: false, ignoreUnresolvedRefs: true }
  )
  if (!validWorkspace) {
    return CliExitCode.AppError
  }

  if (completeFrom !== undefined && !validateEnvs(output, workspace, [completeFrom])) {
    return CliExitCode.UserInputError
  }

  outputLine(Prompts.LIST_UNRESOLVED_START(workspace.currentEnv()), output)
  outputLine(emptyLine(), output)

  try {
    const { found, missing } = await listUnresolvedReferences(workspace, completeFrom)

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
      ENVIRONMENT_OPTION,
    ],
  },
  action: listUnresolvedAction,
})

// Open

type OpenActionArgs = {
  elementId: string
} & EnvArg

const safeGetElementID = (maybeElementIdPath: string, output: CliOutput): ElemID | undefined => {
  try {
    return ElemID.fromFullName(maybeElementIdPath)
  } catch (e) {
    errorOutputLine(e.message, output)
    return undefined
  }
}

export const openAction: WorkspaceCommandAction<OpenActionArgs> = async ({
  input,
  output,
  workspace,
}) => {
  const { elementId } = input
  await validateAndSetEnv(workspace, input, output)

  const elemId = safeGetElementID(elementId, output)
  if (elemId === undefined) {
    return CliExitCode.UserInputError
  }

  const element = await workspace.getValue(elemId)
  if (element === undefined) {
    errorOutputLine(Prompts.NO_MATCHES_FOUND_FOR_ELEMENT(elementId), output)
    return CliExitCode.UserInputError
  }

  const serviceUrl = isElement(element)
    ? element.annotations[CORE_ANNOTATIONS.SERVICE_URL]
    : undefined
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
    keyedOptions: [
      ENVIRONMENT_OPTION,
    ],
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
  ],
})

export default elementGroupDef
