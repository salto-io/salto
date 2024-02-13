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
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { resolvePath, setPath, createSchemeGuard } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { Change, ElemID, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { ValueReplacer, deployModificationFunc, replaceConditionsAndActionsCreator, fieldReplacer } from '../replacers_utils'
import ZendeskClient from '../client/client'
import { paginate } from '../client/pagination'
import { DEPLOY_CONFIG, FETCH_CONFIG } from '../config'

const log = logger(module)
const { isDefined } = lowerDashValues
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const DEFAULT_ORGANIZATION_FIELDS = [{ name: 'organization_id' }]

export type Organization = {
  id: number
  name: string
}

type OrganizationResponse = {
  organizations: Organization[]
}

type SingleOrganizationResponse = {
  organization: Organization
}

type organizationIdInstanceAndPath = {
    instance: InstanceElement
    path: ElemID
    identifier: string
}

const SINGLE_ORGANIZATION_SCHEMA = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().required(),
}).unknown(true)

const ORGANIZATIONS_SCHEMA = Joi.array().items(SINGLE_ORGANIZATION_SCHEMA).required()

const EXPECTED_ORGANIZATION_RESPONSE_SCHEMA = Joi.object({
  organizations: ORGANIZATIONS_SCHEMA,
}).unknown(true)

const EXPECTED_SINGLE_ORGANIZATION_RESPONSE_SCHEMA = Joi.object({
  organization: SINGLE_ORGANIZATION_SCHEMA,
}).unknown(true)

const isOrganizationsResponse = createSchemeGuard<OrganizationResponse>(EXPECTED_ORGANIZATION_RESPONSE_SCHEMA, 'Received an invalid response from organization request')
const isSingleOrganizationResponse = createSchemeGuard<SingleOrganizationResponse>(EXPECTED_SINGLE_ORGANIZATION_RESPONSE_SCHEMA, 'Received an invalid response from single organization request')

const areOrganizations = createSchemeGuard<Organization[]>(ORGANIZATIONS_SCHEMA, 'Received invalid organizations')

export const TYPE_NAME_TO_REPLACER: Record<string, ValueReplacer> = {
  automation: replaceConditionsAndActionsCreator([
    { fieldName: ['conditions', 'all'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
    { fieldName: ['conditions', 'any'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
  ]),
  routing_attribute_value: replaceConditionsAndActionsCreator([
    { fieldName: ['conditions', 'all'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
    { fieldName: ['conditions', 'any'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
  ]),
  sla_policy: replaceConditionsAndActionsCreator([
    { fieldName: ['filter', 'all'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
    { fieldName: ['filter', 'any'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
  ], true),
  trigger: replaceConditionsAndActionsCreator([
    { fieldName: ['conditions', 'all'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
    { fieldName: ['conditions', 'any'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
  ]),
  workspace: replaceConditionsAndActionsCreator([
    { fieldName: ['conditions', 'all'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
    { fieldName: ['conditions', 'any'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
  ], true),
  ticket_field: replaceConditionsAndActionsCreator([
    { fieldName: ['relationship_filter', 'all'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
    { fieldName: ['relationship_filter', 'any'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
  ]),
  view: replaceConditionsAndActionsCreator([
    { fieldName: ['conditions', 'all'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
    { fieldName: ['conditions', 'any'], fieldsToReplace: DEFAULT_ORGANIZATION_FIELDS },
  ]),
  user_segment: fieldReplacer(['organization_ids']),
}

const isRelevantChange = (change: Change<InstanceElement>): boolean => (
  Object.keys(TYPE_NAME_TO_REPLACER).includes(getChangeData(change).elemID.typeName)
)

export const getOrganizationsByIds = async (
  organizationIds: string[],
  client: ZendeskClient,
): Promise<Organization[]> => {
  const results = (await Promise.all(
    _.chunk(organizationIds, 100) // The api limits to 100 ids in each request
      .map(async organizationChunk => {
        const url = `/api/v2/organizations/show_many?ids=${organizationChunk.join(',')}`
        const result = await client.get({ url })
        if (!isOrganizationsResponse(result.data)) {
          log.error('Invalid organizations response')
          return undefined
        }
        return result.data
      })
  )).filter(isDefined)

  return results.flatMap(orgResponse => orgResponse.organizations)
}

export const getOrCreateOrganizationsByNames = async ({
  organizationNames,
  paginator,
  createMissingOrganizations,
  client,
}: {
  organizationNames: string[]
  paginator: clientUtils.Paginator
  createMissingOrganizations?: boolean
  client?: ZendeskClient
 }): Promise<Organization[]> => {
  const paginationArgs = {
    url: '/api/v2/organizations/search',
    paginationField: 'next_page',
  }
  const organizations = (await Promise.all(
    organizationNames
      .map(async organizationName => {
        _.set(paginationArgs, 'queryParams', { name: organizationName })
        const res = (await toArrayAsync(paginator(
          paginationArgs,
          page => makeArray(page) as clientUtils.ResponseValue[],
        ))).flat().flatMap(response => response.organizations)
        if (!areOrganizations(res)) {
          log.error('invalid organization response')
          return undefined
        }

        // the endpoint returns all organizations with names matching the wildcard `organizationName`
        const organization = res.find(org => org.name === organizationName)
        if (organization === undefined) {
          log.debug(`could not find any organization with name ${organizationName}, if createMissingOrganizations it will be created`)
          if (createMissingOrganizations === true) {
            if (client === undefined) {
              log.debug(`client is undefined, can not create org ${organizationName}`)
            } else {
              try {
                const postRes = (await client.post({
                // in case of issues we can also try to use the bulk-create alternative `organizations/create_many`
                  url: '/api/v2/organizations',
                  data: { organization: { name: organizationName } },
                })).data
                if (isSingleOrganizationResponse(postRes)) {
                  return postRes.organization
                }
                log.error(`invalid organization creation response for org name ${organizationName}`)
              } catch (err) {
                log.error(`could not create organization with name ${organizationName}, error is ${err}`)
              }
            }
          }
        }
        return organization
      })
  )).filter(isDefined)

  return organizations
}

// Returns the organization ids or names that are referenced in the instance
export const createOrganizationPathEntries = (instances: InstanceElement[])
    : organizationIdInstanceAndPath[] => {
  const organizationPathsEntries = instances.flatMap(instance => {
    const organizationPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance) ?? []
    return organizationPaths
      .map(path => {
        const orgId = resolvePath(instance, path)
        const stringOrgId = !_.isString(orgId) ? orgId.toString() : orgId
        return { identifier: stringOrgId, instance, path }
      })
  })
    .filter(entry => !_.isEmpty(entry.identifier)) // organization id value might be an empty string
  return organizationPathsEntries
}

/**
 * Replaces organization ids with organization names when 'resolveOrganizationIDs' config flag is enabled
 */
const filterCreator: FilterCreator = ({ client, config }) => {
  let organizationIdToName: Record<string, string> = {}
  const resolveOrganizationIDs = config[FETCH_CONFIG].resolveOrganizationIDs ?? false
  return {
    name: 'organizationsFilter',
    onFetch: async elements => {
      if (resolveOrganizationIDs === false) {
        log.debug('Resolving organization IDs to organization names was disabled (onFetch)')
        return
      }
      const relevantInstances = elements.filter(isInstanceElement)
        .filter(instance => Object.keys(TYPE_NAME_TO_REPLACER).includes(instance.elemID.typeName))

      const pathEntries = createOrganizationPathEntries(relevantInstances)
      const pathEntriesByOrgId = _.groupBy(pathEntries, entry => entry.identifier)
      const organizationIds = _.uniq(Object.keys(pathEntriesByOrgId))

      const organizations = await getOrganizationsByIds(organizationIds, client)
      const mapping = Object.fromEntries(
        organizations.map(org => [org.id.toString(), org.name])
      )
      organizations.forEach(org => {
        const relevantEntries = pathEntriesByOrgId[org.id.toString()] ?? []
        const orgName = mapping[org.id.toString()]
        relevantEntries.forEach(entry => setPath(entry.instance, entry.path, orgName))
      })
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      if (resolveOrganizationIDs === false) {
        log.debug('Resolving organization IDs to organization names was disabled (preDeploy)')
        return
      }
      const relevantChanges = changes.filter(isRelevantChange)
      if (_.isEmpty(relevantChanges)) {
        return
      }
      const organizationNames = _.uniq(relevantChanges.flatMap(change => {
        const instance = getChangeData(change)
        const organizationPaths = TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance)
        return organizationPaths.map(path => resolvePath(instance, path))
      })).filter(name => !_.isEmpty(name)) // filter out empty strings
      if (_.isEmpty(organizationNames)) {
        return
      }

      const paginator = clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      })
      const createMissingOrganizations = config[DEPLOY_CONFIG]?.createMissingOrganizations ?? false
      const organizations = await getOrCreateOrganizationsByNames({
        organizationNames, paginator, createMissingOrganizations, client,
      })
      if (_.isEmpty(organizations)) {
        return
      }
      organizationIdToName = Object.fromEntries(
        organizations.map(org => [org.id.toString(), org.name])
      ) as Record<string, string>
      const organizationNameToId = Object.fromEntries(
        organizations.map(org => [org.name, org.id.toString()])
      ) as Record<string, string>
      await deployModificationFunc(changes, organizationNameToId, TYPE_NAME_TO_REPLACER)
    },
    onDeploy: async (changes: Change<InstanceElement>[]) => {
      if (resolveOrganizationIDs === false) {
        log.debug('Resolving organization IDs to organization names was disabled (onDeploy)')
        return
      }
      const relevantChanges = changes.filter(isRelevantChange)
      if (_.isEmpty(relevantChanges)) {
        return
      }
      await deployModificationFunc(changes, organizationIdToName, TYPE_NAME_TO_REPLACER)
    },
  }
}

export default filterCreator
