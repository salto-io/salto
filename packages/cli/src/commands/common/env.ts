/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Workspace } from '@salto-io/workspace'
import { errorOutputLine } from '../../outputer'
import { CliError, CliExitCode, CliOutput, KeyedOption } from '../../types'

export type EnvArg = {
  env?: string
}

export const ENVIRONMENT_OPTION: KeyedOption<EnvArg> = {
  name: 'env',
  alias: 'e',
  required: false,
  description: 'The name of the environment to use (default=current env)',
  type: 'string',
}

export const validateAndSetEnv = async (workspace: Workspace, envArg: EnvArg, cliOutput: CliOutput): Promise<void> => {
  if (envArg.env !== undefined) {
    if (!workspace.envs().includes(envArg.env)) {
      errorOutputLine(`Unknown environment ${envArg.env}`, cliOutput)
      throw new CliError(CliExitCode.UserInputError)
    }
    await workspace.setCurrentEnv(envArg.env, false)
  }
}
