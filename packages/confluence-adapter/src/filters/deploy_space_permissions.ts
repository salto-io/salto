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
import {
  AdditionChange,
  CORE_ANNOTATIONS,
  Change,
  DeployResult,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  RemovalChange,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { AdapterFilterCreator, FilterResult } from '@salto-io/adapter-components/src/filter_utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import {
  createChangeElementResolver,
  definitions as definitionsUtils,
  deployment,
  references,
  filters,
  fetch as fetchUtils,
} from '@salto-io/adapter-components'
import { naclCase } from '@salto-io/adapter-utils'
import {
  PermissionObject,
  createPermissionUniqueKey,
  isPermissionObject,
  transformPermissionAndUpdateIdMap,
} from '../definitions/transformation_utils/space'
import { ADAPTER_NAME, PERMISSION_TYPE_NAME, SPACE_TYPE_NAME } from '../constants'
import { Options } from '../definitions/types'
import { UserConfig } from '../config'

const log = logger(module)
const { awu } = collections.asynciterable

const permissionObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, PERMISSION_TYPE_NAME) })

const isPermissionObjectArray = (value: unknown[]): value is PermissionObject[] => value.every(isPermissionObject)

const createPermissionMap = (permissions: PermissionObject[]): Map<string, PermissionObject> => {
  const map = new Map<string, PermissionObject>()
  permissions.forEach(permission => {
    map.set(createPermissionUniqueKey(permission), permission)
  })
  return map
}

const calculatePermissionsDiff = (
  change: ModificationChange<InstanceElement>,
): { permissionsToDeleted: PermissionObject[]; permissionsToAdd: PermissionObject[] } => {
  const beforePermissions = _.get(change.data.before.value, 'permissions')
  const afterPermissions = _.get(change.data.after.value, 'permissions')
  if (
    !Array.isArray(beforePermissions) ||
    !Array.isArray(afterPermissions) ||
    !isPermissionObjectArray(beforePermissions) ||
    !isPermissionObjectArray(afterPermissions)
  ) {
    log.warn(
      'permissions are not in expected format: %o, skipping permissions deploy filter on space %s',
      { beforePermissions, afterPermissions },
      getChangeData(change).elemID.getFullName(),
    )
    return { permissionsToDeleted: [], permissionsToAdd: [] }
  }

  const beforePermissionsMap = createPermissionMap(beforePermissions)
  const afterPermissionsMap = createPermissionMap(afterPermissions)
  beforePermissionsMap.forEach(permission => {
    const key = createPermissionUniqueKey(permission)
    if (afterPermissionsMap.has(key)) {
      beforePermissionsMap.delete(key)
      afterPermissionsMap.delete(key)
    }
  })
  afterPermissionsMap.forEach(permission => {
    const key = createPermissionUniqueKey(permission)
    if (beforePermissionsMap.has(key)) {
      beforePermissionsMap.delete(key)
      afterPermissionsMap.delete(key)
    }
  })
  return {
    permissionsToDeleted: Array.from(beforePermissionsMap.values()),
    permissionsToAdd: Array.from(afterPermissionsMap.values()),
  }
}

const filter =
  ({
    convertError = deployment.defaultConvertError,
  }: filters.FilterCreationArgs<Options, UserConfig>): AdapterFilterCreator<{}, FilterResult, {}, Options> =>
  ({ definitions, elementSource }) => ({
    name: 'deploySpacePermissionsFilter',
    deploy: async (changes, changeGroup) => {
      const { deploy, fetch, ...otherDefs } = definitions
      if (deploy === undefined || fetch === undefined) {
        throw new Error('could not find deploy definitions')
      }
      if (changeGroup === undefined) {
        throw new Error('change group not provided')
      }
      const definitionsWithDeployAndFetch = { deploy, fetch, ...otherDefs }
      const [spaceNonRemovalChanges, otherChanges] = _.partition(
        changes,
        change =>
          isInstanceChange(change) &&
          isAdditionOrModificationChange(change) &&
          getChangeData(change).elemID.typeName === SPACE_TYPE_NAME,
      )
      let errors: DeployResult['errors'] = []
      const lookupFunc = references.generateLookupFunc(definitions.references?.rules ?? [])
      const changeResolver = createChangeElementResolver<Change<InstanceElement>>({ getLookUpName: lookupFunc })
      await awu(spaceNonRemovalChanges).forEach(async spaceChange => {
        if (!isAdditionOrModificationChange(spaceChange) || !isInstanceChange(spaceChange)) {
          return
        }
        const deployPermissions = async (
          spaceModificationChange: ModificationChange<InstanceElement>,
        ): Promise<DeployResult['errors']> => {
          const spaceChangeData = getChangeData(spaceModificationChange)
          const { permissionsToDeleted, permissionsToAdd } = calculatePermissionsDiff(spaceModificationChange)
          const permissionsToDeletedIds = permissionsToDeleted
            .map(
              permissionToDelete =>
                spaceChangeData.value.permissionInternalIdMap?.[
                  naclCase(createPermissionUniqueKey(permissionToDelete))
                ],
            )
            .filter(values.isDefined)
            .filter(_.isString)
          const createPermissionRemoveChange = (id: string): RemovalChange<InstanceElement> => ({
            action: 'remove',
            data: {
              before: new InstanceElement(id, permissionObjectType, { id }, [], {
                [CORE_ANNOTATIONS.PARENT]: [spaceChangeData],
              }),
            },
          })

          const createPermissionAdditionChange = (permission: PermissionObject): AdditionChange<InstanceElement> => ({
            action: 'add',
            data: {
              after: new InstanceElement(
                createPermissionUniqueKey(permission),
                permissionObjectType,
                {
                  subject: {
                    type: permission.type,
                    identifier: permission.principalId,
                  },
                  operation: {
                    key: permission.key,
                    target: permission.targetType,
                  },
                },
                [],
                { [CORE_ANNOTATIONS.PARENT]: [spaceChangeData] },
              ),
            },
          })
          const removeChanges = permissionsToDeletedIds.map(createPermissionRemoveChange)
          const removalRes = await deployment.deployChanges({
            changes: removeChanges,
            changeGroup,
            elementSource,
            convertError,
            definitions: definitionsWithDeployAndFetch,
            changeResolver,
          })
          const additionChanges = permissionsToAdd.map(createPermissionAdditionChange)

          const additionRes = await deployment.deployChanges({
            changes: additionChanges,
            changeGroup,
            elementSource,
            convertError,
            definitions: definitionsWithDeployAndFetch,
            changeResolver,
          })
          const newIdsToAdd: Record<string, string> = {}
          additionRes.appliedChanges.forEach(change => {
            if (isInstanceChange(change)) {
              const inst = getChangeData(change)
              transformPermissionAndUpdateIdMap(inst.value, newIdsToAdd)
            }
          })
          spaceChangeData.value.permissionInternalIdMap = {
            ...spaceChangeData.value.permissionInternalIdMap,
            ...newIdsToAdd,
          }
          return [...removalRes.errors, ...additionRes.errors]
        }
        const {
          appliedChanges: [appliedChange],
          errors: spaceDeploymentErrors,
        } = await deployment.deployChanges({
          changes: [spaceChange],
          changeGroup,
          elementSource,
          convertError,
          definitions: definitionsWithDeployAndFetch,
          changeResolver,
        })
        errors = [...spaceDeploymentErrors]
        if (isModificationChange(spaceChange)) {
          const permissionErrors = await deployPermissions(spaceChange)
          errors = [...errors, ...permissionErrors]
        } else {
          // case addition change
          const requester = fetchUtils.request.getRequester<Options>({
            adapterName: ADAPTER_NAME,
            clients: definitions.clients,
            pagination: definitions.pagination,
            requestDefQuery: definitionsUtils.queryWithDefault(
              definitionsUtils.getNestedWithDefault(definitionsWithDeployAndFetch.fetch.instances, 'requests'),
            ),
          })
          const itemsWithContext = await requester.requestAllForResource({
            callerIdentifier: { typeName: PERMISSION_TYPE_NAME },
            contextPossibleArgs: {},
          })
          // creating fake modification change to deploy permissions
          log.error('unexpected space change type %o', itemsWithContext, appliedChange)
        }
      })
      return {
        deployResult: { appliedChanges: spaceNonRemovalChanges, errors },
        leftoverChanges: otherChanges,
      }
    },
  })

export default filter
