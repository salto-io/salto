/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
