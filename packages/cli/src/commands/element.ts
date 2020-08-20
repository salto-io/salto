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
import { Workspace } from '@salto-io/workspace'
import { logger } from '@salto-io/logging'
import { ElemID } from '@salto-io/adapter-api'
import { getCliTelemetry } from '../telemetry'
import { EnvironmentArgs } from './env'
import { convertToIDSelectors } from '../convertors'
import { outputLine, errorOutputLine } from '../outputer'
import { environmentFilter } from '../filters/env'
import { CliCommand, CliExitCode, ParsedCliInput, CliOutput, CliTelemetry, SpinnerCreator } from '../types'
import { createCommandBuilder } from '../command_builder'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import {
  formatTargetEnvRequired, formatInvalidID, formatUnknownTargetEnv, formatCloneToEnvFailed,
  formatMissingCloneArg, formatInvalidEnvTargetCurrent, formatMoveFailed,
  formatInvalidMoveArg, formatInvalidElementCommand,
} from '../formatter'

const log = logger(module)
const COMMON = 'common'
const ENVS = 'envs'

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

const cloneElement = async (
  workspace: Workspace,
  output: CliOutput,
  cliTelemetry: CliTelemetry,
  toEnvs: string[],
  selectors: ElemID[],
): Promise<CliExitCode> => {
  if (!validateEnvs(output, workspace, toEnvs)) {
    cliTelemetry.failure()
    return CliExitCode.UserInputError
  }

  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  try {
    outputLine(Prompts.CLONE_TO_ENV_START(toEnvs), output)
    await workspace.copyTo(selectors, toEnvs)
    await workspace.flush()
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  } catch (e) {
    cliTelemetry.failure()
    errorOutputLine(formatCloneToEnvFailed(e.message), output)
    return CliExitCode.AppError
  }
}

const moveElement = async (
  workspace: Workspace,
  output: CliOutput,
  cliTelemetry: CliTelemetry,
  to: string,
  elmSelectors: ElemID[],
): Promise<CliExitCode> => {
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  try {
    switch (to) {
      case COMMON:
        outputLine(Prompts.MOVE_START('common'), output)
        await workspace.promote(elmSelectors)
        break
      case ENVS:
        outputLine(Prompts.MOVE_START('environment-specific folders'), output)
        await workspace.demote(elmSelectors)
        break
      default:
        errorOutputLine(formatInvalidMoveArg(to), output)
        cliTelemetry.failure()
        return CliExitCode.UserInputError
    }
    await workspace.flush()
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  } catch (e) {
    cliTelemetry.failure()
    errorOutputLine(formatMoveFailed(e.message), output)
    return CliExitCode.AppError
  }
}

export const command = (
  workspaceDir: string,
  output: CliOutput,
  cliTelemetry: CliTelemetry,
  spinnerCreator: SpinnerCreator,
  commandName: string,
  force: boolean,
  inputElmSelectors: string[],
  inputFromEnv?: string,
  inputToEnvs?: string[],
  env?: string,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(
      `running element ${commandName} command on '${workspaceDir}' env=${env}, fromEnv=${inputFromEnv}, toEnvs=${inputToEnvs}
      , force=${force}, elmSelectors=${inputElmSelectors}`
    )

    if ((commandName === 'clone')
    && ((inputFromEnv === undefined) || (inputToEnvs === undefined))) {
      errorOutputLine(formatMissingCloneArg(), output)
      errorOutputLine(Prompts.ELEMENT_CLONE_USAGE, output)
      return CliExitCode.UserInputError
    }
    const sessionEnv = env ?? inputFromEnv ?? undefined
    const toEnvs = inputToEnvs ?? []

    const { ids: elmSelectors, invalidSelectors } = convertToIDSelectors(inputElmSelectors)
    if (!_.isEmpty(invalidSelectors)) {
      errorOutputLine(formatInvalidID(invalidSelectors), output)
      return CliExitCode.UserInputError
    }
    const { workspace, errored } = await loadWorkspace(
      workspaceDir,
      output,
      {
        force: elementArgs.force,
        spinnerCreator,
        sessionEnv,
      }
    )
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }

    switch (commandName) {
      case 'clone':
        return cloneElement(
          workspace,
          output,
          cliTelemetry,
          toEnvs,
          elmSelectors,
        )
      case 'move-to-common':
        return moveElement(workspace, output, cliTelemetry, COMMON, elmSelectors)
      case 'move-to-envs':
        return moveElement(workspace, output, cliTelemetry, ENVS, elmSelectors)
      default:
        errorOutputLine(formatInvalidElementCommand(commandName), output)
        return CliExitCode.UserInputError
    }
  },
})

type CloneArgs = {
  fromEnv: string
  toEnvs: string[]
}

type MoveArgs = {
  to: string
} & EnvironmentArgs

export type ElementArgs = {
  command: string
  force: boolean
  elementSelector: string[]
} & CloneArgs & MoveArgs

type ElementParsedCliInput = ParsedCliInput<ElementArgs>

const elementBuilder = createCommandBuilder({
  filters: [environmentFilter],
  options: {
    command: 'element <command> <element-selector..>',
    description: 'Manage configuration elements',
    positional: {
      command: {
        type: 'string',
        choices: ['clone', 'move-to-common', 'move-to-envs'],
        description: 'The element management command',
      },
      'element-selector': {
        description: 'Array of configuration elements',
      },
    },
    keyed: {
      'from-env': {
        type: 'string',
        desc: 'The environment to clone from (Required for clone)',
        conflicts: ['to', 'env'],
      },
      'to-envs': {
        type: 'array',
        desc: 'The environment to clone to (Required for clone)',
        conflicts: ['to', 'env'],
      },
      force: {
        alias: ['f'],
        describe: 'Clone the elements even if the workspace is invalid.',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },
  async build(input: ElementParsedCliInput, output: CliOutput, spinnerCreator: SpinnerCreator) {
    return command(
      '.',
      output,
      getCliTelemetry(input.telemetry, 'element'),
      spinnerCreator,
      input.args.command,
      input.args.force,
      input.args.elementSelector,
      input.args.fromEnv,
      input.args.toEnvs,
      input.args.env,
    )
  },
})

export type EnvironmentParsedCliInput = ParsedCliInput<ElementParsedCliInput>

export default elementBuilder
