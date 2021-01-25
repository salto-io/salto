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
import { listUnresolvedReferences, Tags } from '@salto-io/core'
import { Workspace, ElementSelector, createElementSelectors } from '@salto-io/workspace'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { createCommandGroupDef, createPublicCommandDef, CommandDefAction } from '../command_builder'
import { CliOutput, CliExitCode, CliTelemetry } from '../types'
import { errorOutputLine, outputLine } from '../outputer'
import { formatTargetEnvRequired, formatUnknownTargetEnv, formatInvalidEnvTargetCurrent, formatCloneToEnvFailed, formatInvalidFilters, formatMoveFailed, emptyLine, formatListUnresolvedFound, formatListUnresolvedMissing, formatElementListUnresolvedFailed } from '../formatter'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import { EnvArg, ENVIRONMENT_OPTION } from './common/env'

const { awu } = collections.asynciterable

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
  workspaceTags: Tags,
  output: CliOutput,
  cliTelemetry: CliTelemetry,
  to: CommonOrEnvs,
  elmSelectors: ElementSelector[],
): Promise<CliExitCode> => {
  try {
    if (to === 'common') {
      outputLine(Prompts.MOVE_START('common'), output)
      await workspace.promote(await awu(await workspace
        .getElementIdsBySelectors(elmSelectors)).toArray())
    } else if (to === 'envs') {
      outputLine(Prompts.MOVE_START('environment-specific folders'), output)
      await workspace.demote(await awu(await workspace
        .getElementIdsBySelectors(elmSelectors, true)).toArray())
    }
    await workspace.flush()
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  } catch (e) {
    cliTelemetry.failure(workspaceTags)
    errorOutputLine(formatMoveFailed(e.message), output)
    return CliExitCode.AppError
  }
}

// Move to common
type ElementMoveToCommonArgs = {
  elementSelector: string[]
} & EnvArg

export const moveToCommonAction: CommandDefAction<ElementMoveToCommonArgs> = async ({
  input,
  cliTelemetry,
  output,
  spinnerCreator,
  workspacePath = '.',
}): Promise<CliExitCode> => {
  log.debug('running move-to-common command on \'%s\' %o', workspacePath, input)
  const { elementSelector, env } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }
  const { workspace, errored } = await loadWorkspace(
    workspacePath,
    output,
    { force: false, spinnerCreator, sessionEnv: env },
  )
  if (errored) {
    cliTelemetry.failure()
    return CliExitCode.AppError
  }
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  return moveElement(workspace, workspaceTags, output, cliTelemetry, 'common', validSelectors)
}

const moveToCommonDef = createPublicCommandDef({
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

export const moveToEnvsAction: CommandDefAction<ElementMoveToEnvsArgs> = async ({
  input,
  cliTelemetry,
  output,
  spinnerCreator,
  workspacePath = '.',
}): Promise<CliExitCode> => {
  log.debug('running move-to-envs command on \'%s\' %o', workspacePath, input)
  const { elementSelector } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }
  const { workspace, errored } = await loadWorkspace(
    workspacePath,
    output,
    { force: false, spinnerCreator, sessionEnv: undefined },
  )
  if (errored) {
    cliTelemetry.failure()
    return CliExitCode.AppError
  }
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  return moveElement(workspace, workspaceTags, output, cliTelemetry, 'envs', validSelectors)
}

const moveToEnvsDef = createPublicCommandDef({
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

export const cloneAction: CommandDefAction<ElementCloneArgs> = async ({
  input,
  cliTelemetry,
  output,
  spinnerCreator,
  workspacePath = '.',
}): Promise<CliExitCode> => {
  log.debug('running clone command on \'%s\' %o', workspacePath, input)
  const { toEnvs, env, elementSelector, force } = input
  const { validSelectors, invalidSelectors } = createElementSelectors(elementSelector)
  if (!_.isEmpty(invalidSelectors)) {
    errorOutputLine(formatInvalidFilters(invalidSelectors), output)
    return CliExitCode.UserInputError
  }
  const { workspace, errored } = await loadWorkspace(
    workspacePath,
    output,
    { force, spinnerCreator, sessionEnv: env },
  )
  if (errored) {
    cliTelemetry.failure()
    return CliExitCode.AppError
  }
  if (!validateEnvs(output, workspace, toEnvs)) {
    cliTelemetry.failure()
    return CliExitCode.UserInputError
  }
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  try {
    outputLine(Prompts.CLONE_TO_ENV_START(toEnvs), output)
    await workspace.copyTo(await awu(await workspace
      .getElementIdsBySelectors(validSelectors)).toArray(), toEnvs)
    await workspace.flush()
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  } catch (e) {
    cliTelemetry.failure()
    errorOutputLine(formatCloneToEnvFailed(e.message), output)
    return CliExitCode.AppError
  }
}

const cloneDef = createPublicCommandDef({
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

export const listUnresolvedAction: CommandDefAction<ElementListUnresolvedArgs> = async ({
  input,
  cliTelemetry,
  output,
  spinnerCreator,
  workspacePath = '.',
}): Promise<CliExitCode> => {
  log.debug('running element list-unresolved command on \'%s\' %o', workspacePath, input)
  const { completeFrom, env } = input
  const { workspace, errored } = await loadWorkspace(
    workspacePath,
    output,
    {
      force: false,
      spinnerCreator,
      sessionEnv: env,
      ignoreUnresolvedRefs: true,
    }
  )
  if (errored) {
    cliTelemetry.failure()
    return CliExitCode.AppError
  }
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)

  if (completeFrom !== undefined && !validateEnvs(output, workspace, [completeFrom])) {
    cliTelemetry.failure(workspaceTags)
    return CliExitCode.UserInputError
  }

  cliTelemetry.start(workspaceTags)
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

    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  } catch (e) {
    log.error(`Error listing elements: ${e}`)
    errorOutputLine(formatElementListUnresolvedFailed(e.message), output)
    cliTelemetry.failure(workspaceTags)
    return CliExitCode.AppError
  }
}

const listUnresolvedDef = createPublicCommandDef({
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
  ],
})

export default elementGroupDef
