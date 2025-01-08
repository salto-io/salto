/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, CORE_ANNOTATIONS, isObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { isCustomObject } from '../../transformers/transformer'
import { FIELD_ANNOTATIONS } from '../../constants'

const { awu } = collections.asynciterable

const filter: FilterCreator = ({ config }) => ({
  name: 'hideReadOnlyValuesFilter',
  onFetch: async (elements: Element[]) => {
    if (config.fetchProfile.dataManagement?.showReadOnlyValues === true) {
      return
    }
    await awu(elements)
      .filter(isCustomObject)
      .filter(isObjectType)
      .forEach(type => {
        Object.values(type.fields).forEach(field => {
          if (!field.annotations[FIELD_ANNOTATIONS.CREATABLE] && !field.annotations[FIELD_ANNOTATIONS.UPDATEABLE]) {
            field.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
          }
        })
      })
  },
})

export default filter
