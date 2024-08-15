/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Element } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'

const fieldNameToTypeMappingDefs: referenceUtils.FieldReferenceDefinition<never>[] = []

/**
 * Convert field values into references, based on predefined rules.
 *
 */
const filter: FilterCreator = () => ({
  name: 'fieldReferencesFilter',
  onFetch: async (elements: Element[]) => {
    await referenceUtils.addReferences({ elements, defs: fieldNameToTypeMappingDefs, fieldsToGroupBy: ['id'] })
  },
})

export default filter
