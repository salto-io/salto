/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { Credentials, adapter } from '@salto-io/zendesk-adapter'
import { addAdapter, fetch, initLocalWorkspace, updateCredentials } from '@salto-io/core'
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { credsLease } from './adapter'

const log = logger(module)

// Set long timeout as we communicate with Zendesk APIs
jest.setTimeout(1000 * 60 * 15)

describe('Zendesk adapter E2E - 2', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>

    beforeAll(async () => {
      log.resetLogCount()
      // get e2eHelpCenter brand
      credLease = await credsLease()
      const workspace = await initLocalWorkspace('/Users/edenhassid/workspaces/testE2E', 'zendesk-env')
      await workspace.setCurrentEnv('zendesk-env', false)
      const authMethods = adapter.authenticationMethods
      const authType = 'basic'
      const configType = authMethods[authType]
      const { credentialsType } = configType
      const newConfig = new InstanceElement(ElemID.CONFIG_NAME, credentialsType, credLease.value)
      await updateCredentials(workspace, newConfig, 'zendesk')
      await addAdapter(workspace, 'zendesk')
      await workspace.flush()
      const res = await fetch(workspace)
      if (res.success) {
        log.debug('success')
      }
      await workspace.updateNaclFiles(res.changes.map(c => c.change))
      const err = await workspace.errors()
      if (err) {
        log.debug('there are errors')
      }
      await workspace.flush()
    })

    it('does nothing', async () => {})
  })
})
