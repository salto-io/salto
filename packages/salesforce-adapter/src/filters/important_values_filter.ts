/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { isMetadataObjectType, MetadataObjectType } from '../transformers/transformer'
import { FilterCreator } from '../filter'

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'salesforceImportantValuesFilter',
  onFetch: async elements => {
    if (!config.fetchProfile.isFeatureEnabled('importantValues')) {
      return
    }
    const { importantValues } = config.fetchProfile
    const addImportantValues = (type: MetadataObjectType): void => {
      const typeFields = new Set(Object.keys(type.fields))
      const typeImportantValues = importantValues.filter(importantValue => typeFields.has(importantValue.value))
      if (typeImportantValues.length > 0) {
        type.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = importantValues.filter(importantValue =>
          typeFields.has(importantValue.value),
        )
      }
    }

    elements.filter(isMetadataObjectType).forEach(addImportantValues)
  },
})

export default filterCreator
