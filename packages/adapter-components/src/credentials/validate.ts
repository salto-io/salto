/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Adapter, InstanceElement } from '@salto-io/adapter-api'
import { ConnectionCreator, validateCredentials } from '../client'

export const defaultValidateCredentials =
  <Credentials>({
    createConnection,
    credentialsFromConfig,
  }: {
    createConnection: ConnectionCreator<Credentials>
    credentialsFromConfig: (config: Readonly<InstanceElement>) => Credentials
  }): Adapter['validateCredentials'] =>
  async config =>
    validateCredentials(credentialsFromConfig(config), {
      createConnection,
    })
