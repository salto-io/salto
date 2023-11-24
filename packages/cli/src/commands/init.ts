/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { initLocalWorkspace, locateWorkspaceRoot } from '@salto-io/core'
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
  envName?: string
}

export const action: CommandDefAction<InitArgs> = async (
  { input: { workspaceName, envName }, cliTelemetry, output, workspacePath },
): Promise<CliExitCode> => {
  log.debug('running workspace init command on \'%s\'', workspaceName)
  cliTelemetry.start()
  try {
    const baseDir = path.resolve(workspacePath)
    const existingWorkspacePath = await locateWorkspaceRoot(baseDir)
    if (existingWorkspacePath !== undefined) {
      errorOutputLine(
        Prompts.initFailed(`existing salto workspace in ${existingWorkspacePath}`),
        output,
      )
      return CliExitCode.AppError
    }
    const defaultEnvName = envName ?? (await getEnvName())
    const workspace = await initLocalWorkspace(baseDir, workspaceName, defaultEnvName)
    cliTelemetry.setTags(getWorkspaceTelemetryTags(workspace))
    cliTelemetry.success()
    outputLine(Prompts.initCompleted(), output)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e : any) {
    errorOutputLine(Prompts.initFailed(e.message), output)
    log.error('workspace init failed with error %s %s', e, e.stack)
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
    keyedOptions: [
      {
        name: 'envName',
        alias: 'e',
        required: false,
        description: 'The name of the first environment in the workspace',
        type: 'string',
      },
    ],
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
