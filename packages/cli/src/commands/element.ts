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
import { ElemID } from '@salto-io/adapter-api'
import { getCliTelemetry } from '../telemetry'
import { EnvironmentArgs } from './env'
import { convertToIDSelectors } from '../convertors'
import { outputLine } from '../outputer'
import { environmentFilter } from '../filters/env'
import { CliCommand, CliExitCode, ParsedCliInput, CliOutput, CliTelemetry, SpinnerCreator } from '../types'
import { createCommandBuilder } from '../command_builder'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import { formatInvalidID, formatStepStart, formatStepFailed, formatStepCompleted, formatUnknownTargetEnv } from '../formatter'

const toCommonInput = 'common'
const toEnvsInput = 'envs'

const validateEnvs = (
  output: CliOutput,
  workspace: Workspace,
  toEnvs: string[] = [],
): boolean => {
  if (toEnvs.length === 0) {
    outputLine('Argument to-env required, received empty.', output)
    return false
  }
  const missingEnvs = toEnvs.filter(e => !workspace.envs().includes(e))
  if (!_.isEmpty(missingEnvs)) {
    outputLine(formatStepFailed(formatUnknownTargetEnv(missingEnvs)), output)
    return false
  }
  if (toEnvs.includes(workspace.currentEnv())) {
    outputLine(formatStepFailed(Prompts.INVALID_ENV_TARGET_CURRENT), output)
    return false
  }
  return true
}

type CopyArgs = {
  force: boolean
  fromEnv: string
  toEnvs: string[]
}

type MoveArgs = {
  to: string
} & EnvironmentArgs

type ElementArgs = {
  command: string
  elmSelectors: string[]
} & CopyArgs & MoveArgs

const copyElement = async (
  workspace: Workspace,
  output: CliOutput,
  cliTelemetry: CliTelemetry,
  copyArgs: CopyArgs,
  selectors: ElemID[],
): Promise<CliExitCode> => {
  if (!validateEnvs(output, workspace, copyArgs.toEnvs)) {
    cliTelemetry.failure()
    return CliExitCode.UserInputError
  }

  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  try {
    outputLine(formatStepStart(Prompts.COPY_TO_ENV_START(copyArgs.toEnvs)), output)
    await workspace.copyTo(selectors, copyArgs.toEnvs)
    await workspace.flush()
    outputLine(formatStepCompleted(Prompts.COPY_TO_ENV_FINISHED), output)
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  } catch (e) {
    cliTelemetry.failure()
    outputLine(formatStepFailed(Prompts.COPY_TO_ENV_FAILED(e.message)), output)
    return CliExitCode.AppError
  }
}

const moveElement = async (
  workspace: Workspace,
  output: CliOutput,
  cliTelemetry: CliTelemetry,
  moveArgs: MoveArgs,
  elmSelectors: ElemID[],
): Promise<CliExitCode> => {
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  try {
    switch (moveArgs.to) {
      case toCommonInput:
        outputLine(formatStepStart(Prompts.MOVE_START('envs', 'common')), output)
        await workspace.promote(elmSelectors)
        break
      case toEnvsInput:
        outputLine(formatStepStart(Prompts.MOVE_START('common', 'envs')), output)
        await workspace.demote(elmSelectors)
        break
      default:
        throw new Error('Unknown direction for move command. \'to\' argument required.')
    }
    await workspace.flush()
    outputLine(formatStepCompleted(Prompts.MOVE_FINISHED), output)
    cliTelemetry.success(workspaceTags)
    return CliExitCode.Success
  } catch (e) {
    cliTelemetry.failure()
    outputLine(formatStepFailed(Prompts.MOVE_FAILED(e.message)), output)
    return CliExitCode.AppError
  }
}

export const command = (
  workspaceDir: string,
  output: CliOutput,
  cliTelemetry: CliTelemetry,
  spinnerCreator: SpinnerCreator,
  elementArgs: ElementArgs,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { ids: elmSelectors, invalidSelectors } = convertToIDSelectors(elementArgs.elmSelectors)
    if (!_.isEmpty(invalidSelectors)) {
      output.stdout.write(formatStepFailed(formatInvalidID(invalidSelectors)))
      return CliExitCode.UserInputError
    }

    const { workspace, errored } = await loadWorkspace(
      workspaceDir,
      output,
      {
        force: elementArgs.force,
        spinnerCreator,
        sessionEnv: elementArgs.env?? elementArgs.fromEnv,
      }
    )
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }

    switch (elementArgs.command) {
      case 'copy':
        return copyElement(
          workspace,
          output,
          cliTelemetry,
          elementArgs as CopyArgs,
          elmSelectors,
        )
      case 'move':
        return moveElement(workspace, output, cliTelemetry, elementArgs as MoveArgs, elmSelectors)
      default:
        throw new Error('Unknown element management command')
    }
  },
})

type ElementParsedCliInput = ParsedCliInput<ElementArgs>

const elementBuilder = createCommandBuilder({
  filters: [environmentFilter],
  options: {
    command: 'element <command> <elm-selectors..>',
    description: 'Manage your elements environment\'s',
    positional: {
      command: {
        type: 'string',
        choices: ['copy', 'move'],
        description: 'The element management command',
      },
    },
    keyed: {
      'from-env': {
        type: 'string',
        desc: 'The environment to copy from (Required for copy)',
        conflicts: ['to', 'env'],
      },
      'to-envs': {
        type: 'array',
        desc: 'The environment to copy to (Required for copy)',
        conflicts: ['to', 'env'],
      },
      to: {
        type: 'string',
        choices: [toCommonInput, toEnvsInput],
        desc: 'Indicating the move direction. Use \'common\' for moving elements '
        + 'from env-specific to the common space and \'envs\' for moving elements '
        + 'from the common to env-specific space. (Required for move)',
      },
      force: {
        alias: ['f'],
        describe: 'Copy the elements even if the workspace is invalid.',
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
      input.args as ElementArgs,
    )
  },
})

export type EnvironmentParsedCliInput = ParsedCliInput<ElementParsedCliInput>

export default elementBuilder
