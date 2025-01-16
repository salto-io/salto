/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Element, isInstanceElement, Value, Values } from '@salto-io/adapter-api'
import { ISSUE_VIEW_TYPE, REQUEST_FORM_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { fetchRequestTypeDetails } from './layout_service_operations'

const deleteEmptyProperties = (fields: Values[]): void => {
  fields.forEach(field => {
    if (field.properties != null) {
      field.properties = Object.entries(field.properties).filter(([_key, value]) => value !== '')
      if (field.properties.length === 0) {
        delete field.properties
      } else {
        field.properties = Object.fromEntries(field.properties)
      }
    }
  })
}

const filterEmptyProperties = (elements: Element[]): void => {
  elements
    .filter(e => e.elemID.typeName === REQUEST_FORM_TYPE)
    .filter(isInstanceElement)
    .forEach(instance => {
      if (Array.isArray(instance.value.issueLayoutConfig?.items)) {
        deleteEmptyProperties(instance.value.issueLayoutConfig.items.map((item: Value) => item.data ?? {}))
      }
    })
}

const filter: FilterCreator = ({ client, config, fetchQuery, getElemIdFunc }) => ({
  name: 'requestTypeLayoutsFilter',
  onFetch: async elements => {
    await fetchRequestTypeDetails({
      elements,
      client,
      config,
      fetchQuery,
      getElemIdFunc,
      typeName: REQUEST_FORM_TYPE,
    })
    filterEmptyProperties(elements)
    await fetchRequestTypeDetails({
      elements,
      client,
      config,
      fetchQuery,
      getElemIdFunc,
      typeName: ISSUE_VIEW_TYPE,
    })
  },
})

export default filter
