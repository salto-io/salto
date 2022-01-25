/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { elements as elementsComponents } from '@salto-io/adapter-components'
import { isObjectType } from '@salto-io/adapter-api'
import { NETSUITE } from '../constants'
import { FilterCreator, FilterWith } from '../filter'
import { getMetadataTypes, isDataObjectType } from '../types'
import { SUPPORTED_TYPES } from '../data_elements/types'


const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const sdfTypeNames = new Set(getMetadataTypes().map(e => e.elemID.getFullName().toLowerCase()))
    const supportedDataTypes = (await elementsComponents
      .filterTypes(
        NETSUITE,
        elements
          .filter(isObjectType)
          .filter(isDataObjectType),
        SUPPORTED_TYPES
      ))
      .filter(e => !sdfTypeNames.has(e.elemID.getFullName().toLowerCase()))

    _.remove(elements, e => isObjectType(e) && isDataObjectType(e))
    elements.push(...supportedDataTypes)
  },
})

export default filterCreator
