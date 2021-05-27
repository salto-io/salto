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
import _ from 'lodash'
import { elements as elementsComponents } from '@salto-io/adapter-components'
import { isObjectType } from '@salto-io/adapter-api'
import { NETSUITE, TYPES_PATH } from '../constants'
import { FilterCreator } from '../filter'
import { SUPPORTED_TYPES } from '../data_elements/data_elements'
import { customTypes, fileCabinetTypes, getAllTypes } from '../types'


const filterCreator: FilterCreator = () => ({
  onFetch: async ({ elements }) => {
    const sdfTypeNames = new Set(getAllTypes().map(e => e.elemID.getFullName()))
    const supportedDataTypes = (await elementsComponents
      .filterTypes(NETSUITE, elements.filter(isObjectType), SUPPORTED_TYPES))
      .filter(e => !sdfTypeNames.has(e.elemID.getFullName()))

    // In case an sdf type was miss-classified as sub type because it was referenced from data type
    const topLevelSdfTypes = [...Object.values(customTypes), ...Object.values(fileCabinetTypes)]
    topLevelSdfTypes.forEach(type => {
      type.path = [NETSUITE, TYPES_PATH, type.elemID.name]
    })

    _.remove(elements, e => isObjectType(e) && e.annotations.source === 'soap')
    elements.push(...supportedDataTypes)
  },
})

export default filterCreator
