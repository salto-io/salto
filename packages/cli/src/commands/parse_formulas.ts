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

import { collections } from '@salto-io/lowerdash'
import { FilterOpts, formulaDepsFilterCreator, buildFetchProfile } from '@salto-io/salesforce-adapter'
import { createCommandGroupDef, createWorkspaceCommand, WorkspaceCommandAction } from '../command_builder'
import { EnvArg, ENVIRONMENT_OPTION, validateAndSetEnv } from './common/env'
import { CliExitCode } from '../types'

const { awu } = collections.asynciterable

export const parseFormulaAction: WorkspaceCommandAction<EnvArg> = async ({
  workspace,
  input,
  output,
}) => {
  await validateAndSetEnv(workspace, input, output)
  const elementsSource = await workspace.elements()

  const filterConfig: Pick<FilterOpts, 'config'> = {
    config: {
      elementsSource,
      fetchProfile: buildFetchProfile({
        optionalFeatures: { skipParsingFormulas: false },
      }),
    },
  }

  const filter = formulaDepsFilterCreator(filterConfig)
  if (!filter.onFetch) {
    return CliExitCode.AppError
  }

  const allElements = await awu(await elementsSource.getAll()).toArray()
  await filter.onFetch(allElements)

  return CliExitCode.Success
}

const parseDef = createWorkspaceCommand({
  properties: {
    name: 'parse',
    description: 'parse formulas',
    keyedOptions: [
      ENVIRONMENT_OPTION,
    ],
    positionalOptions: [
    ],
  },
  action: parseFormulaAction,
})

const formulaGroupDef = createCommandGroupDef({
  properties: {
    name: 'formula',
    description: 'Do things to formulas',
  },
  subCommands: [
    parseDef,
  ],
})

export default formulaGroupDef
