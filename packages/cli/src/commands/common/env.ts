/*
 *                      Copyright 2024 Salto Labs Ltd.
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
