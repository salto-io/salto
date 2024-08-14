/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { isInstanceElement } from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { SERVER_TIME_TYPE_NAME } from '../server_time'
import { getServiceId, isStandardInstanceOrCustomRecordType, isFileCabinetInstance } from '../types'

const log = logger(module)

const filterCreator: LocalFilterCreator = ({ fetchTime }) => ({
  name: 'addInstancesFetchTime',
  /**
   * Add fetchTime as the value in server_time instance's "instancesFetchTime" for all the fetched instances.
   *
   * NOTE: We only add sdf based instances & file cabinet instances - because changes_detector supports only them.
   */
  onFetch: async elements => {
    if (fetchTime === undefined) {
      return
    }

    const serverTimeInstance = elements
      .filter(isInstanceElement)
      .find(inst => inst.elemID.typeName === SERVER_TIME_TYPE_NAME)

    if (serverTimeInstance === undefined) {
      return
    }

    if (serverTimeInstance.value.instancesFetchTime === undefined) {
      serverTimeInstance.value.instancesFetchTime = {}
    }

    elements
      .filter(elem => isStandardInstanceOrCustomRecordType(elem) || isFileCabinetInstance(elem))
      .forEach(elem => {
        const serviceId = getServiceId(elem)
        if (serviceId !== undefined) {
          serverTimeInstance.value.instancesFetchTime[serviceId] = fetchTime.toJSON()
        } else {
          log.warn("Element %s has no serviceId so cannot save it's fetchTime", elem.elemID.getFullName())
        }
      })
  },
})

export default filterCreator
