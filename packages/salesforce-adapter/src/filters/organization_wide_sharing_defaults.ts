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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { RemoteFilterCreator } from '../filter'
import { queryClient } from './utils'
import { createInstanceElement, getSObjectFieldElement, getTypePath } from '../transformers/transformer'
import { API_NAME, METADATA_TYPE, SALESFORCE } from '../constants'
import SalesforceClient from '../client/client'

const log = logger(module)

const toJsCase = (key: string): string => (
  key[0].toLocaleLowerCase() + key.slice(1)
)

const mapKeys = <T>(obj: Record<string, T>, fn: (key: string) => string): Record<string, T> => (
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [fn(key), value]))
)

const filterValues = <T>(obj: Record<string, T>, fn: (value: T) => boolean): Record<string, T> => (
  Object.fromEntries(Object.entries(obj).filter(([key, value]) => [key, fn(value)]))
)

const ORGANIZATION_OBJECT_TYPE = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'Organization'),
  fields: {
    fullName: {
      refType: BuiltinTypes.STRING,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
    [CORE_ANNOTATIONS.UPDATABLE]: false,
    [METADATA_TYPE]: 'Organization',
  },
  isSettings: true,
  path: getTypePath('Organization'),
})

const enrichTypeWithFields = async (client: SalesforceClient, type: ObjectType): Promise<void> => {
  const apiName = type.elemID.typeName // TODO
  const typeDescriptions = await client.describeSObjects([apiName])
  if (typeDescriptions.errors.length !== 0 || typeDescriptions.result.length !== 1) {
    log.warn(`Unexpected response when querying type info for 'Organization'. 
    Errors: %o
    # results: ${typeDescriptions.result.length}`, typeDescriptions.errors)
    return
  }

  const typeDescription = typeDescriptions.result[0]

  const [topLevelFields, nestedFields] = _.partition(typeDescription.fields,
    field => field.compoundFieldName === undefined)

  const objCompoundFieldNames = _.mapValues(
    _.groupBy(nestedFields, field => field.compoundFieldName),
    (_nestedFields, compoundName) => compoundName,
  )

  const fields = topLevelFields
    .map(field => getSObjectFieldElement(type, field, { [API_NAME]: apiName }, objCompoundFieldNames))

  fields.forEach(field => {
    type.fields[toJsCase(field.name)] = field
  })
}

const filterCreator: RemoteFilterCreator = ({ client }) => ({
  onFetch: async elements => {
    const objectType = ORGANIZATION_OBJECT_TYPE.clone()
    await enrichTypeWithFields(client, objectType)

    const queryResult = await queryClient(client, ['SELECT FIELDS(STANDARD) FROM Organization LIMIT 200'])
    if (queryResult.length !== 1) {
      log.error(`Expected Organization object to be a singleton. Got ${queryResult.length} elements`)
      return
    }

    const organizationObject = mapKeys(queryResult[0], toJsCase)
    const organizationInstance = createInstanceElement(
      {
        fullName: 'Organization', // Note: Query results don't have a fullName field
      },
      objectType,
      undefined,
      {
        [CORE_ANNOTATIONS.HIDDEN]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: false,
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      }
    )

    Object.entries(organizationObject)
      .filter(([fieldName]) => Object.keys(objectType.fields).includes(fieldName))
      .forEach(([fieldName, fieldValue]) => {
        if (fieldValue === null) {
          return
        }
        let actualValue = fieldValue
        if (_.isPlainObject(fieldValue)) {
          actualValue = filterValues(fieldValue, value => value !== null)
        }
        organizationInstance.value[fieldName] = actualValue
      })

    elements.push(objectType, organizationInstance)
  },
})

export default filterCreator
