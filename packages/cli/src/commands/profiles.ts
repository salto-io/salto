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

import {
  preview,
} from '@salto-io/core'
import {
  buildFetchProfile,
  profilePermissionsFilterCreator,
} from '@salto-io/salesforce-adapter'
import { createCommandGroupDef, createWorkspaceCommand, WorkspaceCommandAction } from '../command_builder'
import { EnvArg, ENVIRONMENT_OPTION, validateAndSetEnv } from './common/env'
import { CliExitCode } from '../types'
import { outputLine } from '../outputer'
import {
  formatExecutionPlan,
  header,
} from '../formatter'
import Prompts from '../prompts'

export const profilePermissionsAction: WorkspaceCommandAction<EnvArg> = async ({
  workspace,
  input,
  output,
}) => {
  await validateAndSetEnv(workspace, input, output)
  const elementsSource = await workspace.elements()

  const plan = await preview(workspace)

  outputLine(header(Prompts.PLAN_STEPS_HEADER_DEPLOY), output)
  outputLine(await formatExecutionPlan(plan, [], false), output)

  const planItems = [...plan.itemsByEvalOrder()]

  const changes = planItems.flatMap(planItem => [...planItem.changes()])

  const filterConfig = {
    config: {
      elementsSource,
      fetchProfile: buildFetchProfile({}),
    },
  }

  const filter = profilePermissionsFilterCreator(filterConfig)
  if (!filter.preDeploy || !filter.onDeploy) {
    return CliExitCode.AppError
  }

  await filter.preDeploy(changes)
  await filter.onDeploy(changes)

  return CliExitCode.Success
}

const doPermissions = createWorkspaceCommand({
  properties: {
    name: 'permissions',
    description: 'update profile permissions',
    keyedOptions: [
      ENVIRONMENT_OPTION,
    ],
    positionalOptions: [
    ],
  },
  action: profilePermissionsAction,
})

const refsGroupDef = createCommandGroupDef({
  properties: {
    name: 'profiles',
    description: 'Do things to profiles',
  },
  subCommands: [
    doPermissions,
  ],
})

export default refsGroupDef
