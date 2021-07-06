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
import { BuiltinTypes, ElemID, InstanceElement, isInstanceElement, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, naclCase, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { isDataObjectType } from '../types'
import { ACCOUNT_SPECIFIC_VALUE, NETSUITE, RECORDS_PATH } from '../constants'
import { FilterWith } from '../filter'

const { awu } = collections.asynciterable

const isNumberStr = (str: string): boolean => !Number.isNaN(Number(str))

const getSubInstanceName = (path: ElemID, internalId: string): string => {
  const name = _.findLast(path.getFullNameParts(), part => !isNumberStr(part) && part !== 'recordRef')
  return naclCase(`${path.typeName}_${name}_${internalId}`)
}

/**
 * Extract to a new instance every object in a list that contains an internal id
 * (since the internal id is hidden, and we don't support hidden values in lists,
 * the objects in the list need to be extracted to new instances).
 */
const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  onFetch: async elements => {
    const newInstancesMap: Record<string, InstanceElement> = {}

    const transformIds: TransformFunc = async ({ value, field, path }) => {
      const fieldType = await field?.getType()
      if (fieldType?.elemID.name === 'RecordRef') {
        value.id = ACCOUNT_SPECIFIC_VALUE
      }

      if ((field === undefined || fieldType?.elemID.isEqual(BuiltinTypes.UNKNOWN.elemID))
        && value.internalId !== undefined && !path?.isTopLevel()) {
        value.internalId = ACCOUNT_SPECIFIC_VALUE
        delete value.typeId
      }

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
            { ...value, isSubInstance: true },
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
      .filter(async e => isDataObjectType(await e.getType()))
      .forEach(async element => {
        const values = await transformValues({
          values: element.value,
          type: await element.getType(),
          transformFunc: transformIds,
          strict: false,
          pathID: element.elemID,
        }) ?? element.value
        element.value = values
      })

    elements.push(...Object.values(newInstancesMap))
  },

  preDeploy: async changes => {
    await awu(changes)
      .forEach(async change =>
        applyFunctionToChangeData(
          change,
          async element => {
            if (!isInstanceElement(element) || !isDataObjectType(await element.getType())) {
              return element
            }

            element.value = await transformValues({
              values: element.value,
              type: await element.getType(),
              strict: false,
              pathID: element.elemID,
              transformFunc: async ({ value, field, path }) => {
                const fieldType = path?.isTopLevel()
                  ? await element.getType()
                  : await field?.getType()

                if (fieldType?.elemID.name === 'RecordRef') {
                  if (value.id !== '[ACCOUNT_SPECIFIC_VALUE]') {
                    value.internalId = value.id
                  }
                  delete value.id
                }

                return value
              },
            }) ?? element.value

            return element
          }
        ))
  },
})

export default filterCreator
