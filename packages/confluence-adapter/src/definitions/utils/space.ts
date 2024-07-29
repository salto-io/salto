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

import { definitions, deployment, fetch as fetchUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getChangeData, isAdditionChange, isInstanceElement, isReferenceExpression, Value } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { validateValue } from './generic'
import { UserConfig } from '../../config'
import { SPACE_TYPE_NAME } from '../../constants'
import { FetchCriteria, Options } from '../types'

const log = logger(module)

const ALL_SPACE_TYPES = ['global', 'collaboration', 'knowledge_base', 'personal']
const ALL_SPACE_STATUSES = ['current', 'archived']

export type PermissionObject = {
  type: string
  principalId: string
  key: string
  targetType: string
}

export const createPermissionUniqueKey = ({ type, principalId, key, targetType }: PermissionObject): string =>
  `${type}_${principalId}_${key}_${targetType}`

export const isPermissionObject = (value: unknown): value is PermissionObject =>
  _.isString(_.get(value, 'type')) &&
  _.isString(_.get(value, 'principalId')) &&
  _.isString(_.get(value, 'key')) &&
  _.isString(_.get(value, 'targetType'))

/**
 * Restructures a single raw permission object from the service and updates permissionInternalIdMap with the relevant service id.
 * @param permission - raw permission from the service.
 * @param permissionInternalIdMap - serviceIds map to update.
 * @param onFetch - is raw permission came upon fetch or deploy (service returns different structures).
 */
export const transformPermissionAndUpdateIdMap = (
  permission: Value,
  permissionInternalIdMap: Record<string, string>,
  onFetch?: boolean,
): PermissionObject | undefined => {
  const type = onFetch ? _.get(permission, 'principal.type') : _.get(permission, 'subject.type')
  const principalId = onFetch ? _.get(permission, 'principal.id') : _.get(permission, 'subject.identifier')
  const key = _.get(permission, 'operation.key')
  const targetType = onFetch ? _.get(permission, 'operation.targetType') : _.get(permission, 'operation.target')
  const internalId = _.get(permission, 'id')
  if ([type, principalId, key, targetType].some(x => !_.isString(x)) || internalId === undefined) {
    log.warn('permission is not in expected format: %o, skipping', permission)
    return undefined
  }
  permissionInternalIdMap[createPermissionUniqueKey({ type, principalId, key, targetType })] = String(internalId)
  return { type, principalId, key, targetType }
}

/**
 * Restructures permissions array on space instance value and creates an internal ID map.
 * To be used on deploy. We need this as we cannot hide fields inside arrays
 * @param value - value containing raw permissions array from the service.
 */
export const restructurePermissionsAndCreateInternalIdMap = (value: Record<string, unknown>): void => {
  const permissions = _.get(value, 'permissions')
  if (!Array.isArray(permissions)) {
    log.warn('permissions is not an array: %o, skipping space adjust function', permissions)
    return
  }
  const permissionInternalIdMap: Record<string, string> = {}
  const transformedPermissions = permissions
    .map(per => transformPermissionAndUpdateIdMap(per, permissionInternalIdMap, true))
    .filter(values.isDefined)
  value.permissions = transformedPermissions
  value.permissionInternalIdMap = { ...permissionInternalIdMap }
}

/**
 * Adjust function for transforming space instances upon fetch.
 * We reconstruct the permissions so we use this function on resource and not on request.
 */
export const spaceMergeAndTransformAdjust: definitions.AdjustFunctionSingle<{
  fragments: definitions.GeneratedItem[]
}> = async item => {
  const value = validateValue(item.value)
  restructurePermissionsAndCreateInternalIdMap(value)
  return { value }
}

/**
 * Group space with its homepage upon addition.
 * We want to first deploy the space, a default homepage will be created in the service. We want to modify it
 */
export const spaceChangeGroupWithItsHomepage: deployment.grouping.ChangeIdFunction = async change => {
  const changeData = getChangeData(change)
  if (isInstanceElement(changeData)) {
    const homepageRef = changeData.value.homepageId
    // in case of addition, we want the space to be in the same group as its homepage
    if (isAdditionChange(change) && isReferenceExpression(homepageRef)) {
      return homepageRef.elemID.getFullName()
    }
  }
  return changeData.elemID.getFullName()
}

const isSpaceTypeMatch = (typeRegex: string): boolean => fetchUtils.query.isTypeMatch(SPACE_TYPE_NAME, typeRegex)

type FetchEntry = definitions.FetchEntry<FetchCriteria>

const getSpaceDefaults = (query: 'type' | 'status'): string[] =>
  query === 'type' ? ALL_SPACE_TYPES : ALL_SPACE_STATUSES

const getTypesOrStatusesToFetch = ({
  excludeSpaceDefs,
  includeSpaceDefs,
  query,
}: {
  excludeSpaceDefs: FetchEntry[]
  includeSpaceDefs: FetchEntry[]
  query: 'type' | 'status'
}): string[] => {
  const excludeSpaceQuery = excludeSpaceDefs.map(exclude => exclude.criteria?.[query]).filter(values.isDefined)
  const includeSpaceQuery = includeSpaceDefs.map(include => include.criteria?.[query]).filter(values.isDefined)
  const includeSpaceQueryWithDefault = Array.from(
    new Set(includeSpaceQuery.length === 0 ? getSpaceDefaults(query) : includeSpaceQuery),
  )
  return includeSpaceQueryWithDefault.filter(t => !excludeSpaceQuery.includes(t))
}

/*
 * Get space requester and multiply it to several requests if needed to fetch specific space types and statuses.
 * In a single request we can fetch only one type or status, to fetch multiple we need to multiply the request.
 * Not specifying a type or status in the request will fetch all types or statuses.
 * By default we fetch all space types and statuses, unless specified otherwise in the user config.
 */
export const getSpaceRequests = (
  userConfig: UserConfig,
  spaceRequest: definitions.fetch.FetchRequestDefinition<definitions.ResolveClientOptionsType<Options>>,
): definitions.fetch.FetchRequestDefinition<definitions.ResolveClientOptionsType<Options>>[] => {
  const excludeSpaceDefs = userConfig.fetch.exclude.filter(exclude => isSpaceTypeMatch(exclude.type))
  const includeSpaceDefs = userConfig.fetch.include.filter(include => isSpaceTypeMatch(include.type))
  const spaceTypesToFetch = getTypesOrStatusesToFetch({ excludeSpaceDefs, includeSpaceDefs, query: 'type' })
  const spaceStatusesToFetch = getTypesOrStatusesToFetch({ excludeSpaceDefs, includeSpaceDefs, query: 'status' })
  const requestQueryArgs = spaceRequest.endpoint?.queryArgs
  if (spaceTypesToFetch.length === 0 && spaceStatusesToFetch.length === 0) {
    return []
  }
  if (spaceStatusesToFetch.length === 1 && requestQueryArgs !== undefined) {
    ;[requestQueryArgs.status] = spaceStatusesToFetch
  }
  if (spaceTypesToFetch.length === ALL_SPACE_TYPES.length) {
    return [spaceRequest]
  }
  return spaceTypesToFetch.map(type => _.merge({}, spaceRequest, { endpoint: { queryArgs: { type } } }))
}
