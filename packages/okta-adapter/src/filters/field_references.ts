/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { getReferenceDefs, OktaFieldReferenceResolver, contextStrategyLookup } from '../reference_mapping'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG } from '../config'
import { USER_TYPE_NAME } from '../constants'

/**
 * Convert field values into references, based on predefined rules.
 */
const filter: FilterCreator = ({ config, fetchQuery }) => ({
  name: 'fieldReferencesFilter',
  onFetch: async (elements: Element[]) => {
    await referenceUtils.addReferences({
      elements,
      fieldsToGroupBy: ['id', 'name', 'key', 'mappingRuleId', 'kid', 'credentials.oauthClient.client_id'],
      defs: getReferenceDefs({
        enableMissingReferences: config[FETCH_CONFIG].enableMissingReferences,
        isUserTypeIncluded: fetchQuery.isTypeMatch(USER_TYPE_NAME),
      }),
      contextStrategyLookup,
      fieldReferenceResolverCreator: defs => new OktaFieldReferenceResolver(defs),
    })
  },
})

export default filter
