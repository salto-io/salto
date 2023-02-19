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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { CORE_ANNOTATIONS, ElemID, InstanceElement, isInstanceElement, isObjectType, ReferenceExpression, TypeElement } from '@salto-io/adapter-api'
import { naclCase, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { isStandardType, isDataObjectType, isFileCabinetType, isCustomFieldName } from '../types'
import { ACCOUNT_SPECIFIC_VALUE, ID_FIELD, INTERNAL_ID, IS_SUB_INSTANCE, NAME_FIELD, NETSUITE, RECORDS_PATH, RECORD_REF } from '../constants'
import { FilterWith } from '../filter'

const log = logger(module)
const { awu } = collections.asynciterable

const isNumberStr = (str: string): boolean => !Number.isNaN(Number(str))

const getSubInstanceName = (path: ElemID, internalId: string): string => {
  const name = _.findLast(
    path.getFullNameParts(), part => !isNumberStr(part) && part !== RECORD_REF
  )
  return naclCase(`${path.typeName}_${name}_${internalId}`)
}

const hasInternalIdHiddenField = (type: unknown): boolean =>
  isObjectType(type)
  && type.fields[INTERNAL_ID]
  && type.fields[INTERNAL_ID].annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]

const shouldUseIdField = (fieldType: TypeElement | undefined, path: ElemID): boolean =>
  fieldType?.elemID.name === RECORD_REF || (
    isCustomFieldName(path.name) && hasInternalIdHiddenField(fieldType)
  )

const isNestedPath = (path: ElemID | undefined): path is ElemID =>
  path !== undefined && !path.isTopLevel()

/**
 * Extract to a new instance every object in a list that contains an internal id
 * (since the internal id is hidden, and we don't support hidden values in lists,
 * the objects in the list need to be extracted to new instances).
 */
const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  name: 'dataInstancesInternalId',
  onFetch: async elements => {
    const newInstancesMap: Record<string, InstanceElement> = {}
    const recordRefType = elements.filter(isObjectType).find(e => e.elemID.name === RECORD_REF)

    const transformIds: TransformFunc = async ({ value, field, path }) => {
      if (!path || path.isTopLevel() || value[INTERNAL_ID] === undefined) {
        return value
      }

      const originalInternalId = value[INTERNAL_ID]
      const fieldType = await field?.getType()
      if (shouldUseIdField(fieldType, path) || !hasInternalIdHiddenField(fieldType)) {
        value[
          shouldUseIdField(fieldType, path) ? ID_FIELD : INTERNAL_ID
        ] = ACCOUNT_SPECIFIC_VALUE
        delete value.typeId
      }

      const isInsideList = path.getFullNameParts().some(part => isNumberStr(part))
      if (isObjectType(fieldType)
        && (isInsideList
          || isStandardType(fieldType)
          || isFileCabinetType(fieldType))) {
        const instanceName = getSubInstanceName(path, originalInternalId)

        if (!(instanceName in newInstancesMap)) {
          const newInstance = new InstanceElement(
            instanceName,
            // If the fieldType is an SDF type we replace it with RecordRef to avoid validation
            // errors because SDF types has fields with a "required" annotation which might not
            // be fulfilled
            (isStandardType(fieldType) || isFileCabinetType(fieldType))
              && recordRefType !== undefined
              ? recordRefType : fieldType,
            { ...value, [IS_SUB_INSTANCE]: true },
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
    await awu(changes).forEach(async change => {
      await awu(Object.values(change.data))
        .filter(isInstanceElement)
        .filter(async instance => isDataObjectType(await instance.getType()))
        .forEach(async instance => {
          instance.value = await transformValues({
            values: instance.value,
            type: await instance.getType(),
            strict: false,
            pathID: instance.elemID,
            transformFunc: async ({ value, field, path }) => {
              if (
                isNestedPath(path)
                && shouldUseIdField(await field?.getType(), path)
                && value[ID_FIELD] !== undefined
              ) {
                if (value[ID_FIELD] !== ACCOUNT_SPECIFIC_VALUE) {
                  value[INTERNAL_ID] = value[ID_FIELD]
                }
                delete value[ID_FIELD]
              }
              if (isNestedPath(path) && value[INTERNAL_ID] !== undefined) {
                // we want to remove the 'name' field if it is the only one except internalId
                const otherFields = Object.keys(value).filter(key => key !== INTERNAL_ID)
                if (otherFields.length === 1 && otherFields[0] === NAME_FIELD) {
                  log.debug('removing name field from reference in %s', path.getFullName())
                  delete value[NAME_FIELD]
                }
              }
              return value
            },
          }) ?? {}
        })
    })
  },
})

export default filterCreator
