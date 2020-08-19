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
import { Workspace } from '@salto-io/workspace'
import { outputLine } from '../outputer'
import { CliCommand, CliExitCode, ParsedCliInput, CliOutput, CliTelemetry, SpinnerCreator } from '../types'
import { loadWorkspace } from '../workspace/workspace'
import { createCommandBuilder } from '../command_builder'

const copyElement = (
  workspace : Workspace,
  selectorsIds: string[],
): CliExitCode => {
  if (!validateEnvs(output, workspace, targetEnvs)) {
    cliTelemetry.failure()
    return CliExitCode.UserInputError
  }

  const workspaceTags = await getWorkspaceTelemetryTags(workspace)
  cliTelemetry.start(workspaceTags)
  try {
    outputLine(formatStepStart(Prompts.COPY_TO_ENV_START(targetEnvs)), output)
    await workspace.copyTo(selectorsIds, targetEnvs)
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

const moveElement = (

): CliExitCode => {
  return CliExitCode.Success
}

export const command = (
  workspaceDir: string,
  commandName: string,
  cliTelemetry: CliTelemetry,
  output: CliOutput,
  spinnerCreator: SpinnerCreator,
  force: boolean,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    // log.debug
    // TODO: args validation

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

    switch(commandName) {
      case 'copy':
        return copyElement()
      case 'move':
        return moveElement()
      default:
        throw new Error('Unknown element management command')
    }
  },
})

type ElementArgs = {
  command: string
}

type ElementParsedCliInput = ParsedCliInput<ElementArgs>

const envsBuilder = createCommandBuilder({
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
      'from-env' {
        type: 'string',
        desc: 'The environment to copy from'
      },
      'to-env' {
        type: 'string',
        desc: 'The environment to copy to'
      },
    },
  },
  async build(input: ElementParsedCliInput, output: CliOutput) {
    console.log(input.args.elmSelectors)
    return command(
      output,
      input.args.command,
    )
  },
})

export type EnvironmentParsedCliInput = ParsedCliInput<ElementParsedCliInput>

export default envsBuilder
