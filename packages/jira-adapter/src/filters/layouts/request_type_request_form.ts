/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { ISSUE_VIEW_TYPE, REQUEST_FORM_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { fetchRequestTypeDetails } from './layout_service_operations'

type requestTypeRequestFormData = {
  properties?: Record<string, string>
}

type requestTypeRequestFormItemComponent = {
  data: requestTypeRequestFormData
}

const REQUEST_TYPE_REQUEST_FORM_ITEMS_COMPONENT_SCHEME = Joi.array().items(
  Joi.object({
    data: Joi.object({
      properties: Joi.object().pattern(Joi.string(), Joi.string().allow('')).required(),
    })
      .unknown(true)
      .required(),
  })
    .unknown(true)
    .required(),
)

const isRequestTypeRequestFormItemsComponent = createSchemeGuard<requestTypeRequestFormItemComponent[]>(
  REQUEST_TYPE_REQUEST_FORM_ITEMS_COMPONENT_SCHEME,
)

const removePropertiesWithEmptyValues = (elements: Element[]): void => {
  elements
    .filter(e => e.elemID.typeName === REQUEST_FORM_TYPE)
    .filter(isInstanceElement)
    .forEach(instance => {
      const items = instance.value.issueLayoutConfig?.items
      if (isRequestTypeRequestFormItemsComponent(items)) {
        items.forEach(({ data }) => {
          if (data.properties) {
            data.properties = Object.fromEntries(
              Object.entries(data.properties).filter(([_key, value]) => value !== ''),
            )
            if (Object.keys(data.properties).length === 0) {
              delete data.properties
            }
          }
        })
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

    removePropertiesWithEmptyValues(elements)

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
