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
import * as path from 'path'
import { initLocalWorkspace, loadLocalWorkspace } from '@salto-io/core'
import { logger } from '@salto-io/logging'
import { outputLine, errorOutputLine } from '../outputer'
import Prompts from '../prompts'
import { createPublicCommandDef, CommandDefAction } from '../command_builder'
import { CliExitCode } from '../types'
import { getEnvName } from '../callbacks'
import { getWorkspaceTelemetryTags } from '../workspace/workspace'

const log = logger(module)

type InitArgs = {
    workspaceName?: string
  }

class WorkspaceAlreadyExistsError extends Error {
  constructor() {
    super('existing salto workspace')
  }
}

export const action: CommandDefAction<InitArgs> = async (
  { input: { workspaceName }, cliTelemetry, output },
): Promise<CliExitCode> => {
  log.debug('running env init command on \'%s\'', workspaceName)
  cliTelemetry.start()
  try {
    const baseDir = path.resolve('.')
    const doesWorkspaceExists: boolean = await loadLocalWorkspace(baseDir)
      .then(() => true).catch(() => false)
    if (doesWorkspaceExists) {
      throw new WorkspaceAlreadyExistsError()
    }
    const defaultEnvName = await getEnvName()
    const workspace = await initLocalWorkspace(baseDir, workspaceName, defaultEnvName)
    const workspaceTags = await getWorkspaceTelemetryTags(workspace)
    cliTelemetry.success(workspaceTags)
    outputLine(Prompts.initCompleted(workspace.name, baseDir), output)
  } catch (e) {
    errorOutputLine(Prompts.initFailed(e.message), output)
    cliTelemetry.failure()
    cliTelemetry.stacktrace(e)
    return CliExitCode.AppError
  }
  return CliExitCode.Success
}

const initDef = createPublicCommandDef({
  properties: {
    name: 'init',
    description: 'Initialize a new Salto workspace in the current directory',
    positionalOptions: [
      {
        name: 'workspaceName',
        required: false,
        description: 'The name of the workspace',
        type: 'string',
      },
    ],
  },
  action,
})

export default initDef
