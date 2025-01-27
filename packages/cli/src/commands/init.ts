/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as path from 'path'
import { initLocalWorkspace, locateWorkspaceRoot } from '@salto-io/local-workspace'
import { adapterCreators } from '@salto-io/adapter-creators'
import { logger } from '@salto-io/logging'
import { outputLine, errorOutputLine } from '../outputer'
import Prompts from '../prompts'
import { createPublicCommandDef, CommandDefAction } from '../command_builder'
import { CliExitCode } from '../types'
import { getEnvName } from '../callbacks'
import { getWorkspaceTelemetryTags } from '../workspace/workspace'

const log = logger(module)

type InitArgs = {
  envName?: string
}

export const action: CommandDefAction<InitArgs> = async ({
  input: { envName },
  cliTelemetry,
  output,
  workspacePath,
}): Promise<CliExitCode> => {
  log.debug('running workspace init command')
  cliTelemetry.start()
  try {
    const baseDir = path.resolve(workspacePath)
    const existingWorkspacePath = await locateWorkspaceRoot({ lookupDir: baseDir })
    if (existingWorkspacePath !== undefined) {
      errorOutputLine(Prompts.initFailed(`existing salto workspace in ${existingWorkspacePath}`), output)
      return CliExitCode.AppError
    }
    const defaultEnvName = envName ?? (await getEnvName())
    const workspace = await initLocalWorkspace({ baseDir, envName: defaultEnvName, adapterCreators })
    cliTelemetry.setTags(getWorkspaceTelemetryTags(workspace))
    cliTelemetry.success()
    outputLine(Prompts.initCompleted(), output)
  } catch (e) {
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
  },
  action,
})

export default initDef
