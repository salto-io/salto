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
import { ElemID, InstanceElement, isInstanceElement, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { NETSUITE, RECORDS_PATH } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const isNumberStr = (str: string): boolean => !Number.isNaN(Number(str))

const getSubInstanceName = (path: ElemID, internalId: string): string => {
  const name = _.findLast(path.getFullNameParts(), part => !isNumberStr(part) && !['customField', 'customFieldList', 'recordRef'].includes(part))
  return `${path.typeName}_${name}_${internalId}`
}

const filterCreator: FilterCreator = () => ({
  onFetch: async ({ elements }) => {
    const recordRefType = elements.find(e => e.elemID.name === 'RecordRef')

    const newInstancesMap: Record<string, InstanceElement> = {}

    const transformIds: TransformFunc = async ({ value, field, path }) => {
      if ((await field?.getType())?.elemID.name === 'RecordRef') {
        value.id = '[ACCOUNT_SPECIFIC_VALUE]'
      }

      // TODO: remove the ?? recordRefType when custom fields will be appropriately supported
      const fieldType = await field?.getType() ?? recordRefType
      const isInsideList = path?.getFullNameParts().some(part => isNumberStr(part))
      if (path !== undefined
        && value.internalId !== undefined
        && isObjectType(fieldType)
        && isInsideList) {
        const instanceName = getSubInstanceName(path, value.internalId)

        if (!(instanceName in newInstancesMap)) {
          const newInstance = new InstanceElement(
            instanceName,
            fieldType,
            value,
            [NETSUITE, RECORDS_PATH, fieldType.elemID.name, instanceName]
          )
          newInstancesMap[instanceName] = newInstance
        }

        return new ReferenceExpression(newInstancesMap[instanceName].elemID)
      }
      return value
    }

    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async element => {
        const updatedElement = await transformElement({
          element,
          transformFunc: transformIds,
          strict: false,
        })
        element.value = updatedElement.value
      })

    elements.push(...Object.values(newInstancesMap))
  },
})

export default filterCreator
