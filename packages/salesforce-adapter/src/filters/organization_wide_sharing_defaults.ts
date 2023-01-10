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

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { RemoteFilterCreator } from '../filter'
import { queryClient } from './utils'
import { createInstanceElement } from '../transformers/transformer'
import { SALESFORCE, TYPES_PATH } from '../constants'

const log = logger(module)

const ORGANIZATION_OBJECT_TYPE = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'Organization'),
  fields: {
    DefaultAccountAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultCalendarAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultCampaignAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultCaseAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultContactAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultLeadAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultOpportunityAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultPricebookAccess: {
      refType: BuiltinTypes.STRING,
    },
  },
  annotations: {
    // [CORE_ANNOTATIONS.HIDDEN]: true,
    [CORE_ANNOTATIONS.UPDATABLE]: false,
  },
  isSettings: true,
  path: [SALESFORCE, TYPES_PATH, 'Organization'],
})

const filterCreator: RemoteFilterCreator = ({ client }) => ({
  onFetch: async elements => {
    const queryResult = await queryClient(client, ['SELECT FIELDS(ALL) FROM Organization LIMIT 200'])
    if (queryResult.length > 1) {
      log.warn(`Expected Organization object to be a singleton. Got ${queryResult.length} elements`)
      return
    }
    const organizationObject = queryResult[0]
    const relevantFields = Object.entries(organizationObject)
      .filter(([key]) => (Object.keys(ORGANIZATION_OBJECT_TYPE.fields).includes(key)))
    const organizationInstance = createInstanceElement(
      {
        fullName: new ElemID(SALESFORCE, 'Organization', 'instance', organizationObject.Name).getFullName(),
        ...Object.fromEntries(relevantFields),
      },
      ORGANIZATION_OBJECT_TYPE,
      undefined,
      {
        // [CORE_ANNOTATIONS.HIDDEN]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: false,
        // [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      }
    )
    elements.push(ORGANIZATION_OBJECT_TYPE, organizationInstance)
  },
})

export default filterCreator
