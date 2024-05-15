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
  SaltoElementError,
  SaltoError,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  toChange,
} from '@salto-io/adapter-api'
import { AdapterFilterCreator, FilterResult } from '@salto-io/adapter-components/src/filter_utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, types, values } from '@salto-io/lowerdash'
import {
  createChangeElementResolver,
  definitions as definitionsUtils,
  deployment,
  references,
  filters,
  fetch as fetchUtils,
  ChangeElementResolver,
} from '@salto-io/adapter-components'
import { elementExpressionStringifyReplacer, naclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import {
  PermissionObject,
  createPermissionUniqueKey,
  isPermissionObject,
  restructurePermissionsAndCreateInternalIdMap,
  transformPermissionAndUpdateIdMap,
} from '../definitions/utils/space'
import { ADAPTER_NAME, PERMISSION_TYPE_NAME, SPACE_TYPE_NAME } from '../constants'
import { Options } from '../definitions/types'
import { UserConfig } from '../config'

const log = logger(module)
const { awu } = collections.asynciterable

const permissionObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, PERMISSION_TYPE_NAME) })

const isPermissionObjectArray = (value: unknown[]): value is PermissionObject[] => value.every(isPermissionObject)

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
    log.error(
      'permissions are not in expected format: %s, skipping permissions deploy filter on space %s',
      safeJsonStringify({ beforePermissions, afterPermissions }, elementExpressionStringifyReplacer),
      getChangeData(change).elemID.getFullName(),
    )
    return { permissionsToDeleted: [], permissionsToAdd: [] }
  }

  const overlappingPermissionKeys = new Set(
    _.intersection(beforePermissions.map(createPermissionUniqueKey), afterPermissions.map(createPermissionUniqueKey)),
  )
  const removeOverlaps = (permissionList: PermissionObject[]): PermissionObject[] =>
    permissionList.filter(permission => !overlappingPermissionKeys.has(createPermissionUniqueKey(permission)))
  return {
    permissionsToDeleted: removeOverlaps(beforePermissions),
    permissionsToAdd: removeOverlaps(afterPermissions),
  }
}

type DeployPermissionsInput = {
  spaceModificationChange: ModificationChange<InstanceElement>
  definitions: types.PickyRequired<definitionsUtils.ApiDefinitions<Options>, 'deploy'>
  convertError: deployment.ConvertError
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
} & Omit<definitionsUtils.deploy.ChangeAndContext, 'change'>

const deployPermissions = async ({
  spaceModificationChange,
  ...args
}: DeployPermissionsInput): Promise<DeployResult['errors']> => {
  const changeData = getChangeData(spaceModificationChange)
  const { permissionsToDeleted: permissionsToDelete, permissionsToAdd } =
    calculatePermissionsDiff(spaceModificationChange)
  log.debug(
    'Found %d permissions to delete and %d permissions to add',
    permissionsToDelete.length,
    permissionsToAdd.length,
  )
  log.trace(
    'Permissions to delete: %s, permissions to add: %s',
    safeJsonStringify(permissionsToDelete, elementExpressionStringifyReplacer),
    safeJsonStringify(permissionsToAdd, elementExpressionStringifyReplacer),
  )
  const permissionsToDeleteIds = permissionsToDelete
    .map(
      permissionToDelete =>
        changeData.value.permissionInternalIdMap?.[naclCase(createPermissionUniqueKey(permissionToDelete))],
    )
    .filter(values.isDefined)
    .filter(_.isString)
  const createPermissionRemoveChange = (id: string, instanceNamePrefix: string): RemovalChange<InstanceElement> => ({
    action: 'remove',
    data: {
      before: new InstanceElement(`${instanceNamePrefix}_${id}`, permissionObjectType, { id }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [changeData],
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
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [changeData] },
      ),
    },
  })
  const removalChanges = permissionsToDeleteIds.map(id =>
    createPermissionRemoveChange(id, changeData.elemID.getFullName()),
  )
  const removalRes = await deployment.deployChanges({
    changes: removalChanges,
    ...args,
  })
  const additionChanges = permissionsToAdd.map(createPermissionAdditionChange)

  const additionRes = await deployment.deployChanges({
    changes: additionChanges,
    ...args,
  })
  const newIdsToAdd: Record<string, string> = {}
  additionRes.appliedChanges.forEach(change => {
    if (isInstanceChange(change)) {
      const inst = getChangeData(change)
      transformPermissionAndUpdateIdMap(inst.value, newIdsToAdd)
    }
  })
  changeData.value.permissionInternalIdMap = {
    ...changeData.value.permissionInternalIdMap,
    ...newIdsToAdd,
  }
  return [...removalRes.errors, ...additionRes.errors]
}

/*
 * handle space modifications and additions deployment. First we deploy the space itself and then deploy its permissions.
 * In case of addition change, default permissions are created in the service. We fetch the permissions created in the service
 * and calculates the diff between them and the desired permissions. Then we delete and add the relevant permissions.
 */
const filter =
  ({
    convertError = deployment.defaultConvertError,
  }: filters.FilterCreationArgs<Options, UserConfig>): AdapterFilterCreator<{}, FilterResult, {}, Options> =>
  ({ definitions, elementSource, sharedContext }) => ({
    name: 'deploySpaceAndPermissionsFilter',
    deploy: async (changes, changeGroup) => {
      const { deploy, fetch, ...otherDefs } = definitions
      if (deploy === undefined || fetch === undefined) {
        throw new Error('could not find space and space_permission definitions')
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
      const errors: (SaltoError | SaltoElementError)[] = []
      const appliedChanges: Change[] = []
      const lookupFunc = references.generateLookupFunc(definitions.references?.rules ?? [])
      const changeResolver = createChangeElementResolver<Change<InstanceElement>>({ getLookUpName: lookupFunc })
      const deployArgsWithoutChanges = {
        definitions: definitionsWithDeployAndFetch,
        changeGroup,
        elementSource,
        convertError,
        changeResolver,
        sharedContext,
      }
      await awu(spaceNonRemovalChanges)
        // This filter is for TypeScript, we already filtered the changes at the beginning of this filter
        .filter(isInstanceChange)
        .forEach(async spaceChange => {
          const spaceChangeData = getChangeData(spaceChange)
          const { errors: spaceDeploymentErrors } = await deployment.deployChanges({
            changes: [spaceChange],
            ...deployArgsWithoutChanges,
          })
          if (!_.isEmpty(spaceDeploymentErrors)) {
            errors.push(...spaceDeploymentErrors)
            return
          }
          log.debug(
            'successfully deployed space %s, starting to deploy permissions',
            spaceChangeData.elemID.getFullName(),
          )
          appliedChanges.push(spaceChange)
          if (isModificationChange(spaceChange)) {
            const permissionErrors = await deployPermissions({
              spaceModificationChange: spaceChange,
              ...deployArgsWithoutChanges,
            })
            errors.push(...permissionErrors)
          } else {
            // case of addition change
            try {
              const requester = fetchUtils.request.getRequester<Options>({
                adapterName: ADAPTER_NAME,
                clients: definitions.clients,
                pagination: definitions.pagination,
                requestDefQuery: definitionsUtils.queryWithDefault(
                  definitionsUtils.getNestedWithDefault(definitionsWithDeployAndFetch.fetch.instances, 'requests'),
                ),
              })
              // fetch default permissions created in the service
              log.debug(
                'fetching permissions created in the service for space %s',
                spaceChangeData.elemID.getFullName(),
              )
              const itemsWithContext = await requester.requestAllForResource({
                callerIdentifier: { typeName: PERMISSION_TYPE_NAME },
                contextPossibleArgs: { id: [spaceChangeData.value.id] },
              })
              // spaceChangeData must be an InstanceElement. filtered changes at the beginnings of this filter
              const fakeBeforeSpaceInstance = spaceChangeData.clone() as InstanceElement
              fakeBeforeSpaceInstance.value.permissions = itemsWithContext.map(item => item.value)
              restructurePermissionsAndCreateInternalIdMap(fakeBeforeSpaceInstance.value)
              // copy the created `permissionInternalIdMap` from fake instance to the real change data
              spaceChangeData.value.permissionInternalIdMap = fakeBeforeSpaceInstance.value.permissionInternalIdMap
              const fakeModificationChange = toChange({
                before: fakeBeforeSpaceInstance,
                after: spaceChangeData,
              }) as ModificationChange<InstanceElement> // casting for TypeScript only
              const permissionErrors = await deployPermissions({
                spaceModificationChange: fakeModificationChange,
                ...deployArgsWithoutChanges,
              })
              errors.push(...permissionErrors)
            } catch (e) {
              log.error(
                'failed to deploy permissions for space %s with error: %o',
                spaceChangeData.elemID.getFullName(),
                e,
              )
            }
          }
        })
      return {
        deployResult: { appliedChanges, errors },
        leftoverChanges: otherChanges,
      }
    },
  })

export default filter
