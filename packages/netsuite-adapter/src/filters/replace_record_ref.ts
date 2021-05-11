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
import { ElemID, isContainerType, isObjectType, PrimitiveType, PrimitiveTypes } from '@salto-io/adapter-api'
import _ from 'lodash'
import { NETSUITE, SUBTYPES_PATH, TYPES_PATH } from '../constants'
import { FilterCreator } from '../filter'


const filterCreator: FilterCreator = () => ({
  onFetch: async ({ elements }) => {
    const recordRefElemId = new ElemID(NETSUITE, 'RecordRef')
    const recordRefType = new PrimitiveType({
      elemID: recordRefElemId,
      primitive: PrimitiveTypes.UNKNOWN,
      path: [NETSUITE, TYPES_PATH, SUBTYPES_PATH, 'RecordRef'],
    })

    const removedElements = _.remove(elements, e => e.elemID.isEqual(recordRefElemId))
    if (removedElements.length === 0) {
      return
    }

    elements.push(recordRefType)

    elements
      .filter(isObjectType)
      .forEach(element => {
        Object.values(element.fields).forEach(field => {
          const type = isContainerType(field.type) ? field.type.innerType : field.type

          if (type.elemID.isEqual(recordRefElemId)) {
            if (isContainerType(field.type)) {
              field.type.innerType = recordRefType
            } else {
              field.type = recordRefType
            }
          }
        })
      })
  },
})

export default filterCreator
