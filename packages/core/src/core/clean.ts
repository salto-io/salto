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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { Workspace, WorkspaceComponents } from '@salto-io/workspace'
import { cleanDatabases } from '../local-workspace/remote_map'
import { getDefaultAdapterConfig } from './adapters'

const { awu } = collections.asynciterable

const log = logger(module)

export const cleanWorkspace = async (workspace: Workspace, cleanArgs: WorkspaceComponents): Promise<void> => {
  await workspace.clear(_.omit(cleanArgs, 'accountConfig'))
  if (cleanArgs.accountConfig === true) {
    await awu(workspace.accounts()).forEach(async account => {
      const service = workspace.getServiceFromAccountName(account)
      const defaultConfig = await getDefaultAdapterConfig(service, account)
      if (defaultConfig === undefined) {
        // some services might not have configs to restore
        log.info('Cannot restore config for account %s', account)
        return
      }
      await workspace.updateAccountConfig(service, defaultConfig, account)
    })
  }
  await workspace.flush()
  if (cleanArgs.cache === true) {
    await cleanDatabases()
  }
}
