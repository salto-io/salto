/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { isObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { setFieldDeploymentAnnotations } from '../../utils'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME } from '../../constants'

const log = logger(module)

const filter: FilterCreator = () => ({
  name: 'fieldConfigurationFilter',
  onFetch: async elements => {
    const types = elements.filter(isObjectType)

    const fieldConfigurationType = types.find(type => type.elemID.name === FIELD_CONFIGURATION_TYPE_NAME)

    if (fieldConfigurationType === undefined) {
      log.warn(`${FIELD_CONFIGURATION_TYPE_NAME} type not found`)
    } else {
      setFieldDeploymentAnnotations(fieldConfigurationType, 'fields')
    }

    const fieldConfigurationItemType = types.find(type => type.elemID.name === FIELD_CONFIGURATION_ITEM_TYPE_NAME)

    if (fieldConfigurationItemType === undefined) {
      log.warn(`${FIELD_CONFIGURATION_ITEM_TYPE_NAME} type not found`)
    } else {
      ;['id', 'description', 'isHidden', 'isRequired', 'renderer'].forEach(fieldName => {
        setFieldDeploymentAnnotations(fieldConfigurationItemType, fieldName)
      })
    }
  },
})

export default filter
