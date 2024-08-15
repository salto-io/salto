/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Change, ChangeError, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { NetsuiteConfig } from '../config/types'
import NetsuiteClient from '../client/client'

export type NetsuiteChangeValidator = (
  changes: ReadonlyArray<Change>,
  params: {
    deployReferencedElements: boolean
    elementsSource: ReadOnlyElementsSource
    config: NetsuiteConfig
    client: NetsuiteClient
    suiteQLNameToInternalIdsMap: Record<string, Record<string, string[]>>
  },
) => Promise<ReadonlyArray<ChangeError>>
