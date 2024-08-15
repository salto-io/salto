/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { FixElementsFunc, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import OktaClient from '../client/client'
import { OktaUserConfig } from '../user_config'

export type FixElementsArgs = {
  client: OktaClient
  config: OktaUserConfig
  elementsSource: ReadOnlyElementsSource
  fetchQuery: elementUtils.query.ElementQuery
}

export type FixElementsHandler = (args: FixElementsArgs) => FixElementsFunc
