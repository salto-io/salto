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
import _ from 'lodash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { isObjectType } from '@salto-io/adapter-api'
import { NETSUITE } from '../constants'
import { FilterCreator, FilterWith } from '../filter'
import { getMetadataTypes, isCustomRecordType, isDataObjectType, metadataTypesToList } from '../types'
import { SUPPORTED_TYPES, TYPES_TO_INTERNAL_ID } from '../data_elements/types'


const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  name: 'removeUnsupportedTypes',
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const sdfTypeNames = new Set(
      metadataTypesToList(getMetadataTypes())
        .map(e => e.elemID.getFullName().toLowerCase())
    )
    const dataTypes = elements.filter(isObjectType).filter(isDataObjectType)
    const supportedFetchedInstancesTypeNames = SUPPORTED_TYPES
    // types we fetch without their instances
    const additionalFetchedTypes = Object.keys(TYPES_TO_INTERNAL_ID)
    const customRecordTypeNames = dataTypes.filter(isCustomRecordType).map(({ elemID }) => elemID.name)

    const supportedTypeNames = _.uniq(
      supportedFetchedInstancesTypeNames
        .concat(additionalFetchedTypes)
        .concat(customRecordTypeNames)
    )

    const supportedDataTypes = (await elementUtils.filterTypes(NETSUITE, dataTypes, supportedTypeNames))
      .filter(e => !sdfTypeNames.has(e.elemID.getFullName().toLowerCase()))
      .filter(e => !isObjectType(e) || !isCustomRecordType(e))

    _.remove(elements, e => isObjectType(e) && isDataObjectType(e) && !isCustomRecordType(e))
    elements.push(...supportedDataTypes)
  },
})

export default filterCreator
