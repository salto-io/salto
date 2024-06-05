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

import { logger } from '@salto-io/logging'
import { getInsights } from '@salto-io/core'
import { WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { CliExitCode } from '../types'

const log = logger(module)

export const insightsAction: WorkspaceCommandAction<{}> = async ({ workspace }) => {
  try {
    const insights = await getInsights(workspace)
    log.info('gathered %d insights', insights.length)
    insights.forEach(insight => {
      log.info(insight.message, {
        isInsight: true,
        adapter: insight.path.adapter,
        path: insight.path.getFullName(),
        ruleId: insight.ruleId,
      })
    })
  } catch (e) {
    log.error('failed to get insights with error: %o', e)
  }
  return CliExitCode.Success
}

const InsightsCmd = createWorkspaceCommand({
  properties: {
    name: 'insights',
    description: 'Get insights about the configuration in the connected accounts',
  },
  action: insightsAction,
})

export default InsightsCmd
