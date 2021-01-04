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
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { promises } from '@salto-io/lowerdash'
import { Workspace, WorkspaceComponents } from '@salto-io/workspace'
import { getDefaultAdapterConfig } from './adapters'

const log = logger(module)

export const cleanWorkspace = async (
  workspace: Workspace,
  cleanArgs: WorkspaceComponents,
): Promise<void> => {
  await workspace.clear(_.omit(cleanArgs, 'serviceConfig'))
  if (cleanArgs.serviceConfig) {
    await promises.array.series(workspace.services().map(service => (async () => {
      const defaultConfig = getDefaultAdapterConfig(service)
      if (defaultConfig === undefined) {
        // some services, like hubspot, don't have configs to restore
        log.info('Cannot restore config for service %s', service)
        return undefined
      }
      return workspace.updateServiceConfig(service, defaultConfig)
    })))
  }
  await workspace.flush()
}
