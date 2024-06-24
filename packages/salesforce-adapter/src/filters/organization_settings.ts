/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterContext, RemoteFilterCreator } from '../filter'
import { ensureSafeFilterFetch, queryClient, safeApiName } from './utils'
import {
  getSObjectFieldElement,
  getTypePath,
} from '../transformers/transformer'
import {
  API_NAME,
  ORGANIZATION_API_VERSION,
  ORGANIZATION_SETTINGS,
  RECORDS_PATH,
  SALESFORCE,
  SETTINGS_PATH,
} from '../constants'
import SalesforceClient from '../client/client'
import { FetchProfile } from '../types'

const log = logger(module)

const ORGANIZATION_SETTINGS_INSTANCE_NAME = 'OrganizationSettings'
export const LATEST_SUPPORTED_API_VERSION_FIELD = 'LatestSupportedApiVersion'

/*
 * These fields are not multienv friendly
 * */
const FIELDS_TO_IGNORE = [
  'DailyWebToCaseCount',
  'DailyWebToLeadCount',
  'InstanceName',
  'IsSandbox',
  'LastWebToCaseDate',
  'LastWebToLeadDate',
  'MonthlyPageViewsEntitlement',
  'MonthlyPageViewsUsed',
  'OrganizationType',
  'SelfServiceCaseSubmitRecordTypeId',
  'SelfServiceEmailUserOnCaseCreationTemplateId',
  'SelfServiceNewCommentTemplateId',
  'SelfServiceNewPassTemplateId',
  'SelfServiceNewUserTemplateId',
  'SelfServiceSolutionCategoryStartNodeId',
  'TrialExpirationDate',
  'WebToCaseAssignedEmailTemplateId',
  'WebToCaseCreatedEmailTemplateId',
  'WebToCaseDefaultCreatorId',
]

const enrichTypeWithFields = async (
  client: SalesforceClient,
  type: ObjectType,
  fieldsToIgnore: Set<string>,
  fetchProfile: FetchProfile,
): Promise<void> => {
  const typeApiName = await safeApiName(type)
  if (typeApiName === undefined) {
    log.error('Failed getting OrganizationSettings API name.')
    return
  }
  const describeSObjectsResult = await client.describeSObjects([typeApiName])
  if (
    describeSObjectsResult.errors.length !== 0 ||
    describeSObjectsResult.result.length !== 1
  ) {
    log.warn(
      'describeSObject on %o failed with errors: %o and %o results',
      typeApiName,
      describeSObjectsResult.errors,
      describeSObjectsResult.result.length,
    )
    return
  }

  const [typeDescription] = describeSObjectsResult.result

  const [topLevelFields, nestedFields] = _.partition(
    typeDescription.fields,
    (field) => _.isNil(field.compoundFieldName),
  )

  const objCompoundFieldNames = _.mapValues(
    _.groupBy(nestedFields, (field) => field.compoundFieldName),
    (_nestedFields, compoundName) => compoundName,
  )

  const fields = topLevelFields.map((field) =>
    getSObjectFieldElement(
      type,
      field,
      { [API_NAME]: typeApiName },
      objCompoundFieldNames,
      fetchProfile,
    ),
  )

  type.fields = {
    ...type.fields,
    ..._(fields)
      .filter((field) => !fieldsToIgnore.has(field.name))
      .keyBy((field) => field.name)
      .value(),
  }
}

const createOrganizationType = (config: FilterContext): ObjectType =>
  new ObjectType({
    elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS),
    fields: config.fetchProfile.isFeatureEnabled('latestSupportedApiVersion')
      ? {
          [LATEST_SUPPORTED_API_VERSION_FIELD]: {
            refType: BuiltinTypes.NUMBER,
            annotations: {
              [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
            },
          },
        }
      : {},
    annotations: {
      [CORE_ANNOTATIONS.UPDATABLE]: false,
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.DELETABLE]: false,
      [API_NAME]: ORGANIZATION_SETTINGS,
    },
    isSettings: true,
    path: getTypePath(ORGANIZATION_SETTINGS),
  })

const createOrganizationInstance = (
  objectType: ObjectType,
  fieldValues: Values,
): InstanceElement =>
  new InstanceElement(
    ElemID.CONFIG_NAME,
    objectType,
    _.pick(fieldValues, Object.keys(objectType.fields)),
    [
      SALESFORCE,
      RECORDS_PATH,
      SETTINGS_PATH,
      ORGANIZATION_SETTINGS_INSTANCE_NAME,
    ],
  )

const createOrganizationApiVersionElements = (): [
  ObjectType,
  InstanceElement,
] => {
  const objectType = new ObjectType({
    elemID: new ElemID(SALESFORCE, ORGANIZATION_API_VERSION),
    fields: {
      [LATEST_SUPPORTED_API_VERSION_FIELD]: {
        refType: BuiltinTypes.NUMBER,
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
      [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      [CORE_ANNOTATIONS.UPDATABLE]: false,
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.DELETABLE]: false,
    },
    isSettings: true,
    path: getTypePath(ORGANIZATION_API_VERSION),
  })

  const instance = new InstanceElement(ElemID.CONFIG_NAME, objectType)

  return [objectType, instance]
}

type AddLatestSupportedAPIVersionParams = {
  client: SalesforceClient
  apiVersionInstance: InstanceElement
  organizationInstance?: InstanceElement
}
const addLatestSupportedAPIVersion = async ({
  client,
  apiVersionInstance,
  organizationInstance,
}: AddLatestSupportedAPIVersionParams): Promise<void> => {
  const versions = await client.request('/services/data/')
  if (!Array.isArray(versions)) {
    log.error(
      `Got a non-array response when getting supported API versions: ${versions}`,
    )
    return
  }

  const latestVersion = _(versions)
    .map((ver) => ver?.version)
    .map(_.toNumber)
    .filter(_.isFinite)
    .max()

  if (latestVersion === undefined) {
    log.error('Could not get the latest supported API version.')
    return
  }

  apiVersionInstance.value[LATEST_SUPPORTED_API_VERSION_FIELD] = latestVersion
  if (organizationInstance !== undefined) {
    organizationInstance.value[LATEST_SUPPORTED_API_VERSION_FIELD] =
      latestVersion
  }
}

const FILTER_NAME = 'organizationSettings'
export const WARNING_MESSAGE = 'Failed to fetch OrganizationSettings.'

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: FILTER_NAME,
  remote: true,
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    fetchFilterFunc: async (elements) => {
      // SALTO-4821
      if (config.fetchProfile.metadataQuery.isFetchWithChangesDetection()) {
        return
      }
      const objectType = createOrganizationType(config)
      const fieldsToIgnore = new Set(
        FIELDS_TO_IGNORE.concat(config.systemFields ?? []),
      )
      await enrichTypeWithFields(
        client,
        objectType,
        fieldsToIgnore,
        config.fetchProfile,
      )

      const queryResult = await queryClient(client, [
        'SELECT FIELDS(ALL) FROM Organization LIMIT 200',
      ])
      if (queryResult.length !== 1) {
        log.error(
          `Expected Organization object to be a singleton. Got ${queryResult.length} elements`,
        )
        return
      }

      const organizationInstance = createOrganizationInstance(
        objectType,
        queryResult[0],
      )

      // TODO (SALTO-5978): Remove once we enable the optional feature.
      const [apiVersionType, apiVersionInstance] =
        createOrganizationApiVersionElements()

      const addLatestSupportedAPIVersionParams: AddLatestSupportedAPIVersionParams =
        {
          client,
          apiVersionInstance,
        }
      if (config.fetchProfile.isFeatureEnabled('latestSupportedApiVersion')) {
        addLatestSupportedAPIVersionParams.organizationInstance =
          organizationInstance
      }
      await addLatestSupportedAPIVersion(addLatestSupportedAPIVersionParams)

      elements.push(
        objectType,
        organizationInstance,
        apiVersionType,
        apiVersionInstance,
      )
    },
  }),
})

export default filterCreator
