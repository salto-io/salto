/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PROJECT_ROLE_TYPE } from '../constants'
import { FIELD_TYPE_NAME } from './fields/constants'

const RELEVANT_TYPES = [PROJECT_ROLE_TYPE, FIELD_TYPE_NAME]

const filter: FilterCreator = () => ({
  name: 'missingDescriptionsFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => RELEVANT_TYPES.includes(instance.elemID.typeName))
      .filter(instance => instance.value.description === undefined)
      .forEach(instance => {
        instance.value.description = ''
      })
  },
})

export default filter
