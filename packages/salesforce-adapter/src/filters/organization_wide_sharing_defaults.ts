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
import { API_NAME, INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, SALESFORCE } from '../constants'
import SalesforceClient from '../client/client'

const log = logger(module)


const enrichTypeWithFields = async (client: SalesforceClient, type: ObjectType): Promise<void> => {
  const apiName = type.elemID.typeName // TODO
  const describeSObjectsResult = await client.describeSObjects([apiName])
  if (describeSObjectsResult.errors.length !== 0 || describeSObjectsResult.result.length !== 1) {
    log.warn('describeSObject on %o failed with errors: %o and %o results',
      apiName,
      describeSObjectsResult.errors,
      describeSObjectsResult.result.length)
    return
  }

  const [typeDescription] = describeSObjectsResult.result

  const [topLevelFields, nestedFields] = _.partition(typeDescription.fields,
    field => field.compoundFieldName === undefined)

  const objCompoundFieldNames = _.mapValues(
    _.groupBy(nestedFields, field => field.compoundFieldName),
    (_nestedFields, compoundName) => compoundName,
  )

  const fields = topLevelFields
    .map(field => getSObjectFieldElement(type, field, { [API_NAME]: apiName }, objCompoundFieldNames))

  type.fields = { ...type.fields, ..._.keyBy(fields, field => _.camelCase(field.name)) }
}

const createOrganizationType = (): ObjectType => (
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'Organization'),
    fields: {
      fullName: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.UPDATABLE]: false,
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.DELETABLE]: false,
      [METADATA_TYPE]: 'Organization',
    },
    isSettings: true,
    path: getTypePath('Organization'),
  })
)

const filterCreator: RemoteFilterCreator = ({ client }) => ({
  name: 'organization_wide_sharing_defaults',
  onFetch: async elements => {
    const objectType = createOrganizationType()
    await enrichTypeWithFields(client, objectType)

    const queryResult = await queryClient(client, ['SELECT FIELDS(ALL) FROM Organization LIMIT 200'])
    if (queryResult.length !== 1) {
      log.error(`Expected Organization object to be a singleton. Got ${queryResult.length} elements`)
      return
    }

    const organizationObject = _.mapKeys(queryResult[0], (_value, key) => _.camelCase(key))

    const organizationInstance = createInstanceElement(
      {
        [INSTANCE_FULL_NAME_FIELD]: 'OrganizationSettings', // Note: Query results don't have a fullName field
        ..._.pick(organizationObject, Object.keys(objectType.fields)),
      },
      objectType,
      undefined,
      {
        [CORE_ANNOTATIONS.UPDATABLE]: false,
        [CORE_ANNOTATIONS.CREATABLE]: false,
        [CORE_ANNOTATIONS.DELETABLE]: false,
      }
    )

    elements.push(objectType, organizationInstance)
  },
})

export default filterCreator
