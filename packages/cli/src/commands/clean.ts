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
import { EOL } from 'os'
import { loadLocalWorkspace, cleanWorkspace } from '@salto-io/core'
import { WorkspaceComponents } from '@salto-io/workspace'
import { getWorkspaceTelemetryTags } from '../workspace/workspace'
import { errorOutputLine, outputLine } from '../outputer'
import { getUserBooleanInput } from '../callbacks'
import { formatCleanWorkspace, formatCancelCommand, header, formatStepStart, formatStepFailed, formatStepCompleted } from '../formatter'
import Prompts from '../prompts'
import { CliExitCode } from '../types'
import { createPublicCommandDef, CommandDefAction } from '../command_builder'

const log = logger(module)

type CleanArgs = {
  force: boolean
} & WorkspaceComponents

const action: CommandDefAction<CleanArgs> = async ({
  input: { force, ...cleanArgs },
  cliTelemetry,
  output,
  workspacePath = '.',
}): Promise<CliExitCode> => {
  log.debug('running clean command on \'%s\', force=%s, args=%o', workspacePath, force, cleanArgs)
  const shouldCleanAnything = Object.values(cleanArgs).some(shouldClean => shouldClean)
  if (!shouldCleanAnything) {
    outputLine(header(Prompts.EMPTY_PLAN), output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }
  if (cleanArgs.staticResources && !(cleanArgs.state && cleanArgs.cache && cleanArgs.nacl)) {
    errorOutputLine('Cannot clear static resources without clearing the state, cache and nacls', output)
    outputLine(EOL, output)
    return CliExitCode.UserInputError
  }

  const workspace = await loadLocalWorkspace(workspacePath)
  const workspaceTags = await getWorkspaceTelemetryTags(workspace)

  outputLine(header(
    formatCleanWorkspace(cleanArgs)
  ), output)
  if (!(force || await getUserBooleanInput(Prompts.SHOULD_EXECUTE_PLAN))) {
    outputLine(formatCancelCommand, output)
    return CliExitCode.Success
  }

  outputLine(formatStepStart(Prompts.CLEAN_STARTED), output)
  cliTelemetry.start(workspaceTags)

  try {
    await cleanWorkspace(workspace, cleanArgs)
  } catch (e) {
    errorOutputLine(formatStepFailed(Prompts.CLEAN_FAILED(e.toString())), output)
    cliTelemetry.failure(workspaceTags)
    return CliExitCode.AppError
  }

  outputLine(formatStepCompleted(Prompts.CLEAN_FINISHED), output)
  outputLine(EOL, output)
  cliTelemetry.success(workspaceTags)
  return CliExitCode.Success
}

const cleanDef = createPublicCommandDef({
  properties: {
    name: 'clean',
    description: 'Maintenance command for cleaning workspace data. This operation cannot be undone, it\'s highly recommended to backup the workspace data before executing it.',
    options: [
      {
        name: 'force',
        alias: 'f',
        description: 'Do not ask for approval before applying the changes',
        type: 'boolean',
      },
      {
        name: 'nacl',
        alias: 'n',
        description: 'Do not remove the nacl files',
        type: 'boolean',
        default: true,
      },
      {
        name: 'state',
        alias: 's',
        description: 'Do not clear the state',
        type: 'boolean',
        default: true,
      },
      {
        name: 'cache',
        alias: 'c',
        description: 'Do not clear the cache',
        type: 'boolean',
        default: true,
      },
      {
        name: 'staticResources',
        alias: 'r',
        description: 'Do not remove remove the static resources',
        type: 'boolean',
        default: true,
      },
      {
        name: 'credentials',
        alias: 'l',
        description: 'Clear the service login credentials',
        type: 'boolean',
        default: false,
      },
      {
        name: 'serviceConfig',
        alias: 'g',
        description: 'Restore service configuration to default',
        type: 'boolean',
        default: false,
      },
    ],
  },
  action,
})

export default cleanDef
