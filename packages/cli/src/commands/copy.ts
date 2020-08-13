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
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { Workspace } from '@salto-io/workspace'
import { convertToIDSelectors } from '../convertors'
import { ParsedCliInput, CliOutput, SpinnerCreator, CliExitCode, CliCommand, CliTelemetry } from '../types'
import { createCommandBuilder } from '../command_builder'
import { getCliTelemetry } from '../telemetry'
import { loadWorkspace, getWorkspaceTelemetryTags } from '../workspace/workspace'
import Prompts from '../prompts'
import { formatStepStart, formatStepFailed, formatInvalidID, formatStepCompleted, formatUnknownTargetEnv } from '../formatter'
import { outputLine } from '../outputer'

const log = logger(module)

const validateEnvs = (
  output: CliOutput,
  workspace: Workspace,
  targetEnvs: string[] = [],
): boolean => {
  if (targetEnvs.length === 0) {
    return true
  }
  const missingEnvs = targetEnvs.filter(e => !workspace.envs().includes(e))
  if (!_.isEmpty(missingEnvs)) {
    outputLine(formatStepFailed(formatUnknownTargetEnv(missingEnvs)), output)
    return false
  }
  if (targetEnvs.includes(workspace.currentEnv())) {
    outputLine(formatStepFailed(Prompts.INVALID_ENV_TARGET_CURRENT), output)
    return false
  }
  return true
}

export const command = (
  workspaceDir: string,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  force: boolean,
  inputSelectors: string[],
  targetEnvs?: string[],
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    log.debug(`running copy command on '${workspaceDir}', targetEnvs=${
      targetEnvs}, inputSelectors=${inputSelectors}`)
    const { ids, invalidSelectors } = convertToIDSelectors(inputSelectors)
    if (!_.isEmpty(invalidSelectors)) {
      output.stdout.write(formatStepFailed(formatInvalidID(invalidSelectors)))
      return CliExitCode.UserInputError
    }

    const { workspace, errored } = await loadWorkspace(
      workspaceDir,
      output,
      {
        force,
        spinnerCreator,
      }
    )
    if (errored) {
      cliTelemetry.failure()
      return CliExitCode.AppError
    }
    if (!validateEnvs(output, workspace, targetEnvs)) {
      cliTelemetry.failure()
      return CliExitCode.UserInputError
    }

    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.start(workspaceTags)
    try {
      outputLine(formatStepStart(Prompts.COPY_TO_ENV_START(targetEnvs)), output)
      await workspace.copyTo(ids, targetEnvs)
      await workspace.flush()
      outputLine(formatStepCompleted(Prompts.COPY_TO_ENV_FINISHED), output)
      cliTelemetry.success(workspaceTags)
      return CliExitCode.Success
    } catch (e) {
      cliTelemetry.failure()
      outputLine(formatStepFailed(Prompts.COPY_TO_ENV_FAILED(e.message)), output)
      return CliExitCode.AppError
    }
  },
})

type CopyArgs = {
  force: boolean
  env: string
  targetEnv: string[]
  selectors: string[]
}

type CopyParsedCliInput = ParsedCliInput<CopyArgs>

const copyBuilder = createCommandBuilder({
  options: {
    command: 'copy [selectors..]',
    description: 'Copy the selected elements to the target environment(s), overriding existing elements.',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Copy the elements even if the workspace is invalid.',
        boolean: true,
        default: false,
        demandOption: false,
      },
      // will also be available as targetEnv because of camel-case-expansion
      'target-env': {
        alias: ['t'],
        describe: 'Only copy the elements to the specified environment(s) (default=all)',
        type: 'array',
        string: true,
      },
    },
  },

  async build(
    input: CopyParsedCliInput,
    output: CliOutput,
    spinnerCreator: SpinnerCreator
  ): Promise<CliCommand> {
    return command(
      '.',
      getCliTelemetry(input.telemetry, 'copy'),
      output,
      spinnerCreator,
      input.args.force,
      input.args.selectors,
      input.args.targetEnv,
    )
  },
})

export default copyBuilder
