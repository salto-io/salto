/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, isObjectType } from '@salto-io/adapter-api'
import { isDataObjectType } from '../types'
import { LocalFilterCreator } from '../filter'

const HIDDEN_FIELDS = ['internalId']

const filterCreator: LocalFilterCreator = () => ({
  name: 'hiddenFields',
  onFetch: async elements => {
    elements
      .filter(isObjectType)
      .filter(isDataObjectType)
      .forEach(type =>
        Object.values(type.fields).forEach(field => {
          if (HIDDEN_FIELDS.includes(field.elemID.name)) {
            field.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
          }
        }),
      )
  },
})

export default filterCreator
