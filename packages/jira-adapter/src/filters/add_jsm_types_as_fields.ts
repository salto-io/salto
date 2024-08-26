/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { CUSTOMER_PERMISSIONS_TYPE, PROJECT_TYPE } from '../constants'

const filter: FilterCreator = ({ config }) => ({
  name: 'addJsmTypesAsFieldsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    const customerPermissionInstances = _.remove(
      elements,
      e => e.elemID.typeName === CUSTOMER_PERMISSIONS_TYPE && isInstanceElement(e),
    )
    customerPermissionInstances.filter(isInstanceElement).forEach(customerPermission => {
      const project = customerPermission.value.projectKey?.value
      delete customerPermission.value.projectKey
      if (project?.elemID.typeName === PROJECT_TYPE) {
        project.value.customerPermissions = customerPermission.value
      }
    })
  },
})
export default filter
