/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { isInstanceElement } from '@salto-io/adapter-api'
import { getParent, hasValidParent, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  CALENDAR_TYPE,
  QUEUE_TYPE,
  PORTAL_GROUP_TYPE,
  REQUEST_TYPE_NAME,
  PORTAL_SETTINGS_TYPE_NAME,
  SLA_TYPE_NAME,
  FORM_TYPE,
} from '../constants'

const JSM_ELEMENT_DIRECTORY: Record<string, string> = {
  [QUEUE_TYPE]: 'queues',
  [CALENDAR_TYPE]: 'calendars',
  [REQUEST_TYPE_NAME]: 'requestTypes',
  [PORTAL_GROUP_TYPE]: 'portalGroups',
  [PORTAL_SETTINGS_TYPE_NAME]: 'portalSettings',
  [SLA_TYPE_NAME]: 'SLAs',
  [FORM_TYPE]: 'forms',
}
const filter: FilterCreator = ({ config }) => ({
  name: 'jsmPathsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(instance => Object.keys(JSM_ELEMENT_DIRECTORY).includes(instance.elemID.typeName))
      .filter(instance => hasValidParent(instance))
      .forEach(instance => {
        const parent = getParent(instance)
        const parentPath = parent.path
        if (parentPath === undefined) {
          return
        }
        const dirName = JSM_ELEMENT_DIRECTORY[instance.elemID.typeName]
        instance.path = [...parentPath.slice(0, -1), dirName, pathNaclCase(instance.elemID.name)]
      })
  },
})
export default filter
