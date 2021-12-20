/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { createRefToElmWithValue, Element, isObjectType, isType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'

const log = logger(module)

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const typeByLowerName = _.keyBy(
      elements.filter(isType),
      e => e.elemID.typeName.toLowerCase()
    )
    const projectType = elements
      .filter(isObjectType)
      .find(e => e.elemID.typeName === 'Project')
    if (projectType === undefined) {
      log.warn('Could not set field types for scheme fields. No Project ObjectType found')
      return
    }

    const setFieldTypes = (...fieldNames: string[]): void => {
      fieldNames
        .forEach(fieldName => {
          projectType.fields[fieldName]
            .refType = createRefToElmWithValue(typeByLowerName[fieldName.toLowerCase()])
        })
    }
    setFieldTypes(
      'workflowScheme',
      'permissionScheme',
      'notificationScheme',
      'issueTypeScreenScheme',
      'fieldConfigurationScheme',
    )
  },
})

export default filter
