/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
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

    const fieldConfigurationType = types
      .find(type => type.elemID.name === FIELD_CONFIGURATION_TYPE_NAME)

    if (fieldConfigurationType === undefined) {
      log.warn(`${FIELD_CONFIGURATION_TYPE_NAME} type not found`)
    } else {
      setFieldDeploymentAnnotations(fieldConfigurationType, 'fields')
    }

    const fieldConfigurationItemType = types
      .find(type => type.elemID.name === FIELD_CONFIGURATION_ITEM_TYPE_NAME)

    if (fieldConfigurationItemType === undefined) {
      log.warn(`${FIELD_CONFIGURATION_ITEM_TYPE_NAME} type not found`)
    } else {
      ['id', 'description', 'isHidden', 'isRequired', 'renderer'].forEach(fieldName => {
        setFieldDeploymentAnnotations(fieldConfigurationItemType, fieldName)
      })
    }
  },
})

export default filter
