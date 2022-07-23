/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { EOL } from 'os'
import { migrateWorkspace } from '@salto-io/core'
import { formatStepStart, formatStepFailed, formatStepCompleted } from '../formatter'
import { outputLine, errorOutputLine } from '../outputer'
import Prompts from '../prompts'
import { CliExitCode } from '../types'
import { createCommandGroupDef, createWorkspaceCommand, WorkspaceCommandAction } from '../command_builder'

type MigrationArgs = {
  force: boolean
}

export const migrateAction: WorkspaceCommandAction<MigrationArgs> = async ({
  input: { force },
  output,
  workspace,
}): Promise<CliExitCode> => {
  outputLine(formatStepStart(Prompts.MIGRATION_STARTED), output)

  try {
    await migrateWorkspace(workspace, force)
  } catch (e) {
    errorOutputLine(formatStepFailed(Prompts.MIGRATION_FAILED(e.toString())), output)
    return CliExitCode.AppError
  }

  outputLine(formatStepCompleted(Prompts.MIGRATION_FINISHED), output)
  outputLine(EOL, output)
  return CliExitCode.Success
}

const wsMigrateZendeskDef = createWorkspaceCommand({
  properties: {
    name: 'migrate-zendesk',
    description: 'Migrate Zendesk adapter name from zendesk_support to zendesk',
    keyedOptions: [
      {
        name: 'force',
        alias: 'f',
        required: false,
        default: false,
        description: 'Force the migration',
        type: 'boolean',
      },
    ],
  },
  action: migrateAction,
})

// Group definition
const wsGroupDef = createCommandGroupDef({
  properties: {
    name: 'migration',
    description: 'Workspace migration commands',
  },
  subCommands: [
    wsMigrateZendeskDef,
  ],
})

export default wsGroupDef
