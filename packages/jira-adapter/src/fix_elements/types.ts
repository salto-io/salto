/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { FixElementsFunc, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'

export type FixElementsArgs = {
  client: JiraClient
  config: JiraConfig
  elementsSource: ReadOnlyElementsSource
}

export type FixElementsHandler = (args: FixElementsArgs) => FixElementsFunc
