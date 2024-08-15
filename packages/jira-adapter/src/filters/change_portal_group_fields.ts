/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PORTAL_GROUP_TYPE } from '../constants'

const filter: FilterCreator = ({ config }) => ({
  name: 'changePortalGroupFieldsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    elements
      .filter(element => element.elemID.typeName === PORTAL_GROUP_TYPE)
      .filter(isInstanceElement)
      .forEach(instance => {
        instance.value.ticketTypeIds = instance.value.ticketTypes
        delete instance.value.ticketTypes
      })
  },
})

export default filter
