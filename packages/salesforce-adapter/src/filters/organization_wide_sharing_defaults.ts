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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterWith } from '../filter'
import { queryClient } from './utils'
import { apiName, getSObjectFieldElement, getTypePath } from '../transformers/transformer'
import {
  API_NAME,
  ORGANIZATION_SETTINGS,
  RECORDS_PATH,
  SALESFORCE, SETTINGS_PATH,
} from '../constants'
import SalesforceClient from '../client/client'

const log = logger(module)

const ORGANIZATION_SETTINGS_INSTANCE_NAME = 'OrganizationSettings'

const enrichTypeWithFields = async (client: SalesforceClient, type: ObjectType): Promise<void> => {
  const typeApiName = await apiName(type)
  const describeSObjectsResult = await client.describeSObjects([typeApiName])
  if (describeSObjectsResult.errors.length !== 0 || describeSObjectsResult.result.length !== 1) {
    log.warn('describeSObject on %o failed with errors: %o and %o results',
      typeApiName,
      describeSObjectsResult.errors,
      describeSObjectsResult.result.length)
    return
  }

  const [typeDescription] = describeSObjectsResult.result

  const [topLevelFields, nestedFields] = _.partition(typeDescription.fields,
    field => _.isNil(field.compoundFieldName))

  const objCompoundFieldNames = _.mapValues(
    _.groupBy(nestedFields, field => field.compoundFieldName),
    (_nestedFields, compoundName) => compoundName,
  )

  const fields = topLevelFields
    .map(field => getSObjectFieldElement(type, field, { [API_NAME]: typeApiName }, objCompoundFieldNames))

  type.fields = {
    ...type.fields,
    ..._.keyBy(fields, field => field.name),
  }
}

const createOrganizationType = (): ObjectType => (
  new ObjectType({
    elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS),
    fields: {
    },
    annotations: {
      [CORE_ANNOTATIONS.UPDATABLE]: false,
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.DELETABLE]: false,
      [API_NAME]: ORGANIZATION_SETTINGS,
    },
    isSettings: true,
    path: getTypePath(ORGANIZATION_SETTINGS),
  })
)

const createOrganizationInstance = (objectType: ObjectType, fieldValues: Values): InstanceElement => (
  new InstanceElement(
    ElemID.CONFIG_NAME,
    objectType,
    _.pick(fieldValues, Object.keys(objectType.fields)),
    [SALESFORCE, RECORDS_PATH, SETTINGS_PATH, ORGANIZATION_SETTINGS_INSTANCE_NAME],
  )
)

const filterCreator = ({ client }: { client: SalesforceClient}): FilterWith<'onFetch'> => ({
  name: 'organizationWideSharingDefaultsFilter',
  onFetch: async elements => {
    const objectType = createOrganizationType()
    await enrichTypeWithFields(client, objectType)

    const queryResult = await queryClient(client, ['SELECT FIELDS(ALL) FROM Organization LIMIT 200'])
    if (queryResult.length !== 1) {
      log.error(`Expected Organization object to be a singleton. Got ${queryResult.length} elements`)
      return
    }

    const organizationInstance = createOrganizationInstance(objectType, queryResult[0])

    elements.push(objectType, organizationInstance)
  },
})

export default filterCreator
