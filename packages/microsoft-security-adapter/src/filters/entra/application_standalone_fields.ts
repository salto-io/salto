/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { v4 as uuid4 } from 'uuid'
import { values } from '@salto-io/lowerdash'
import {
  Change,
  ChangeGroup,
  DeployResult,
  Element,
  InstanceElement,
  ReadOnlyElementsSource,
  SaltoElementError,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isRemovalChange,
} from '@salto-io/adapter-api'
import {
  applyFunctionToChangeDataSync,
  getInstancesFromElementSource,
  getParent,
  getParents,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { deployment } from '@salto-io/adapter-components'
import { entraConstants, PARENT_ID_FIELD_NAME } from '../../constants'
import { FilterCreator } from '../../definitions/types'
import { customConvertError } from '../../error_utils'
import { changeResolver } from '../../definitions/references'

const {
  TOP_LEVEL_TYPES: { APP_ROLE_TYPE_NAME, APPLICATION_TYPE_NAME, OAUTH2_PERMISSION_SCOPE_TYPE_NAME },
  APP_ROLES_FIELD_NAME,
  API_FIELD_NAME,
  DELEGATED_PERMISSION_IDS_FIELD_NAME,
  PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME,
  OAUTH2_PERMISSION_SCOPES_FIELD_NAME,
} = entraConstants

const log = logger(module)
const { isDefined, isPlainObject } = values

type CustomDeployChangesFunc = (params: {
  changes: Change<InstanceElement>[]
  changeGroup: ChangeGroup
}) => Promise<DeployResult>

type DeployResultWithLeftoverChanges = { deployResult: DeployResult; leftoverChanges: Change[] }

type ParentChangeWithExistingFlag = {
  parentChange: Change<InstanceElement>
  isExistingChange: boolean
}

const RELEVANT_TYPE_NAMES = [APP_ROLE_TYPE_NAME, OAUTH2_PERMISSION_SCOPE_TYPE_NAME]

const isInstanceElementOfRelevantTypes = (elem: Element): elem is InstanceElement =>
  isInstanceElement(elem) && RELEVANT_TYPE_NAMES.includes(elem.elemID.typeName)

const isInstanceChangeOfRelevantTypes = (change: Change): change is Change<InstanceElement> =>
  isInstanceElementOfRelevantTypes(getChangeData(change))

const getPermissionScopeFieldPath = (parentTypeName: string): string[] =>
  parentTypeName === APPLICATION_TYPE_NAME
    ? [API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME]
    : [OAUTH2_PERMISSION_SCOPES_FIELD_NAME]

const removeDuplicatedInstances = async (elements: Element[]): Promise<void> => {
  const potentiallyDuplicatedInstances = elements
    .map((elem, index) => ({ elem, index }))
    .filter(({ elem }) => isInstanceElementOfRelevantTypes(elem))

  const duplicatedInstances = Object.values(
    _.groupBy(potentiallyDuplicatedInstances, ({ elem }) => elem.elemID.getFullName()),
  ).filter(instances => instances.length > 1)

  const instancesToRemove = duplicatedInstances.flatMap(instances => {
    // We prefer to keep the extracted instances with the application parent, if it exists,
    // since attempting to deploy it as part of the Service Principal will fail due to inconsistencies with the application.
    const instanceWithApplicationParentIdx = instances.findIndex(
      ({ elem }) => getParents(elem)[0]?.elemID.typeName === APPLICATION_TYPE_NAME,
    )
    if (instanceWithApplicationParentIdx === -1) {
      // This shouldn't happen, as we expect to find at most 2 similar extracted instances, when one of them has an application parent
      log.warn(
        'Found multiple %s with the same elemID, but none of them have an application parent',
        instances[0].elem.elemID.typeName,
      )
      // Arbitrarily remove all except the first
      return instances.slice(1)
    }
    return instances.filter((_instance, index) => index !== instanceWithApplicationParentIdx)
  })

  log.trace(
    'Removing the following instances: %s',
    instancesToRemove.map(({ elem }) => elem.elemID.getFullName()).join(', '),
  )
  const indicesToRemove = instancesToRemove.map(({ index }) => index)
  // We remove the changes from the array in reverse order to avoid changing the indices of the elements we still need to remove
  indicesToRemove.sort((a, b) => b - a).forEach(index => elements.splice(index, 1))
}

const extractUniqueParentsFromInstanceChanges = (
  instanceChanges: Change<InstanceElement>[],
): { uniqueParents: InstanceElement[]; errors: SaltoElementError[] } => {
  const parentsOrErrors = instanceChanges.map((change): InstanceElement | SaltoElementError => {
    try {
      return getParent(getChangeData(change))
    } catch (e) {
      log.error('Failed to get parent for %s: %o', getChangeData(change).elemID.getFullName(), e)
      const message = `Expected ${getChangeData(change).elemID.typeName} to have an application or service principal parent`
      return {
        elemID: getChangeData(change).elemID,
        message,
        detailedMessage: message,
        severity: 'Error',
      }
    }
  })
  const [parents, errors] = _.partition(parentsOrErrors, isInstanceElement)
  return {
    uniqueParents: _.uniqBy(parents, parent => parent.elemID.getFullName()),
    errors,
  }
}

const addIdToInstance = (
  instance: InstanceElement,
  instanceNameToInternalId: Record<string, string>,
): InstanceElement => {
  if (instance.value.id === undefined) {
    instance.value.id = instanceNameToInternalId[instance.elemID.getFullName()]
  }
  return instance
}

const groupInstancesByParent = async (
  elementSource: ReadOnlyElementsSource,
  instanceNameToInternalId: Record<string, string>,
): Promise<Record<string, InstanceElement[]>> =>
  _.groupBy(
    (await getInstancesFromElementSource(elementSource, RELEVANT_TYPE_NAMES)).map(instance =>
      addIdToInstance(instance.clone(), instanceNameToInternalId),
    ),
    // If no parent is found & the instance is not part of the received changes, we will just skip it
    elem => getParents(elem)[0]?.elemID.getFullName(),
  )

const addStandaloneFieldsToParentChange = ({
  parentChange,
  parentToInstancesMap,
  instanceNameToInternalId,
}: {
  parentChange: Change<InstanceElement>
  parentToInstancesMap: Record<string, InstanceElement[]>
  instanceNameToInternalId: Record<string, string>
}): void => {
  const parent = getChangeData(parentChange)
  const [appRoleInstances, permissionScopeInstances] = _.partition(
    parentToInstancesMap[parent.elemID.getFullName()] ?? [],
    instance => instance.elemID.typeName === APP_ROLE_TYPE_NAME,
  )
  _.set(
    parent.value,
    APP_ROLES_FIELD_NAME,
    appRoleInstances.map(appRole => appRole.value),
  )
  _.set(
    parent.value,
    getPermissionScopeFieldPath(parent.elemID.typeName),
    permissionScopeInstances.map(permissionScope => permissionScope.value),
  )
  const preAuthorizedApps = _.get(parent.value, [API_FIELD_NAME, PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME], [])
  preAuthorizedApps.forEach((preAuthorizedApp: unknown) => {
    if (!isPlainObject(preAuthorizedApp)) {
      log.error('Unexpected pre-authorized application value %s', safeJsonStringify(preAuthorizedApp))
      return
    }

    const delegatedPermissionIds = _.get(preAuthorizedApp, DELEGATED_PERMISSION_IDS_FIELD_NAME, [])
    delegatedPermissionIds.forEach((ref: unknown) => {
      if (isReferenceExpression(ref)) {
        // The permission references are not resolved properly for newly created permissions, since they didn't have an id
        // We need to set the id manually
        if (isInstanceElement(ref.value) && ref.value.value.id === undefined) {
          ref.value.value.id = instanceNameToInternalId[ref.value.elemID.getFullName()]
        }
      }
    })
  })
}

const setOrCreateParentChangeWithStandaloneFields = ({
  parent,
  otherChanges,
  parentToInstancesMap,
  instanceNameToInternalId,
}: {
  parent: InstanceElement
  otherChanges: Change[]
  parentToInstancesMap: Record<string, InstanceElement[]>
  instanceNameToInternalId: Record<string, string>
}): ParentChangeWithExistingFlag | undefined => {
  const parentFullName = parent.elemID.getFullName()
  const existingParentChange = _.remove(
    otherChanges,
    change => getChangeData(change).elemID.getFullName() === parentFullName,
  )[0]

  if (existingParentChange !== undefined) {
    // We shouldn't really reach this point, as we validate the parent in 'extractUniqueParentsFromInstanceChanges', but just for TS to be happy
    if (!isInstanceChange(existingParentChange)) {
      log.error('Parent %s is not an instance change, skipping its app extracted instances deployment', parentFullName)
      return undefined
    }

    if (isRemovalChange(existingParentChange)) {
      // We need to deploy removal changes using the filter in order to know whether the extracted fields changes should be marked as applied or not
      return { parentChange: existingParentChange, isExistingChange: true }
    }
  }

  const parentChange = existingParentChange ?? {
    action: 'modify' as const,
    data: {
      before: parent,
      after: parent.clone(),
    },
  }

  addStandaloneFieldsToParentChange({ parentChange, parentToInstancesMap, instanceNameToInternalId })

  return { parentChange, isExistingChange: existingParentChange !== undefined }
}

const calculateDeployResult = ({
  deployResult: { errors, appliedChanges: appliedParentChanges },
  parentChanges,
  relevantInstanceChanges,
  instancesWithNoParentErrors,
  instanceNameToInternalId,
}: {
  deployResult: DeployResult
  parentChanges: ParentChangeWithExistingFlag[]
  relevantInstanceChanges: Change<InstanceElement>[]
  instancesWithNoParentErrors: SaltoElementError[]
  instanceNameToInternalId: Record<string, string>
}): DeployResult => {
  const appliedParentChangesFullNames = appliedParentChanges.map(change => getChangeData(change).elemID.getFullName())
  const appliedExistingParentChanges = parentChanges
    .filter(
      ({ parentChange, isExistingChange }) =>
        isExistingChange && appliedParentChangesFullNames.includes(getChangeData(parentChange).elemID.getFullName()),
    )
    .map(({ parentChange }) =>
      // We add the extracted fields to the parent change in place, but we shouldn't include it in the applied change,
      // so we remove it before returning it as an applied change.
      // The reason we don't just use the original change is that the applied changes may contain the id returned from the service,
      // which we want to keep.
      applyFunctionToChangeDataSync(parentChange, instance => {
        instance.value = _.omit(instance.value, [
          APP_ROLES_FIELD_NAME,
          getPermissionScopeFieldPath(instance.elemID.typeName).join('.'),
        ])
        if (instance.value[API_FIELD_NAME] !== undefined && _.isEmpty(instance.value[API_FIELD_NAME])) {
          delete instance.value[API_FIELD_NAME]
        }
        return instance
      }),
    )
  const appliedStandaloneFieldsChanges = relevantInstanceChanges.filter(change =>
    appliedParentChangesFullNames.includes(getParents(getChangeData(change))[0]?.elemID.getFullName()),
  )
  appliedStandaloneFieldsChanges.forEach(change => addIdToInstance(getChangeData(change), instanceNameToInternalId))
  return {
    errors: errors.concat(instancesWithNoParentErrors),
    appliedChanges: appliedExistingParentChanges.concat(appliedStandaloneFieldsChanges),
  }
}

const deployStandaloneFieldsChangesViaParent = async ({
  changes,
  changeGroup,
  elementSource,
  deployChangesFunc,
}: {
  changes: Change[]
  changeGroup: ChangeGroup
  elementSource: ReadOnlyElementsSource
  deployChangesFunc: CustomDeployChangesFunc
}): Promise<DeployResultWithLeftoverChanges> => {
  const [relevantInstanceChanges, otherChanges] = _.partition(changes, isInstanceChangeOfRelevantTypes)
  // We must specify an id for each field object on addition.
  // Since they're not deployed on their own we should also make sure to update their matching changes with the id we generate.
  const instanceNameToInternalId = Object.fromEntries(
    relevantInstanceChanges.map(change => [
      getChangeData(change).elemID.getFullName(),
      getChangeData(change).value.id ?? uuid4(),
    ]),
  )
  const parentToInstancesMap = await groupInstancesByParent(elementSource, instanceNameToInternalId)

  const { uniqueParents, errors: instancesWithNoParentErrors } =
    extractUniqueParentsFromInstanceChanges(relevantInstanceChanges)
  const parentChanges = uniqueParents
    .map(parent =>
      setOrCreateParentChangeWithStandaloneFields({
        parent,
        parentToInstancesMap,
        otherChanges,
        instanceNameToInternalId,
      }),
    )
    .filter(isDefined)
  const changesToDeploy = parentChanges.map(({ parentChange }) => parentChange)

  const calculateDeployResultLocal = (deployResult: DeployResult): DeployResultWithLeftoverChanges => ({
    deployResult: calculateDeployResult({
      deployResult,
      parentChanges,
      relevantInstanceChanges,
      instancesWithNoParentErrors,
      instanceNameToInternalId,
    }),
    leftoverChanges: otherChanges,
  })

  if (_.isEmpty(changesToDeploy)) {
    return calculateDeployResultLocal({ errors: [], appliedChanges: [] })
  }

  const deployResult = await deployChangesFunc({
    changes: changesToDeploy,
    changeGroup: {
      ...changeGroup,
      changes: changesToDeploy,
    },
  })

  return calculateDeployResultLocal(deployResult)
}

/*
 * Add parent_id to the newly added standalone fields.
 * This is needed to ensures uniqueness in serviceId for those fields, whose IDs uniqueness is parent-contextual.
 */
const addParentIdToChanges = async (changes: Change[]): Promise<void> => {
  const relevantChanges = changes.filter(isInstanceChangeOfRelevantTypes).filter(isAdditionOrModificationChange)
  relevantChanges.forEach(relevantChange => {
    const changeData = getChangeData(relevantChange)
    if (changeData.value[PARENT_ID_FIELD_NAME] === undefined) {
      try {
        const parent = getParent(changeData)
        if (parent.value.id === undefined) {
          // This can only happen if the parent was added in the same deploy operation
          const parentChange = _.find(changes, change => getChangeData(change).elemID.isEqual(parent.elemID))
          if (parentChange === undefined || !isInstanceChange(parentChange)) {
            log.error('Failed to find parent id for %s', changeData.elemID.getFullName())
            return
          }
          changeData.value[PARENT_ID_FIELD_NAME] = getChangeData(parentChange).value.id
        } else {
          changeData.value[PARENT_ID_FIELD_NAME] = parent.value.id
        }
      } catch (e) {
        log.error('Failed to set parent id for %s: %o', changeData.elemID.getFullName(), e)
      }
    }
  })
}

/**
 * Handles the duplications & deployment of 2 extracted fields from the application/service principal:
 * - App roles
 * - OAuth2 permission scopes
 * We extract these fields to top level instances in order to be able to reference them.
 * However, it creates a problem both in the fetch and deploy phases:
 * - In the fetch phase, these instances can be retrieved either from the application or from the service principal, with the same values.
 *   We cannot filter them in advance (i.e. fetch only the application's/SP's relevant fields), since the application/SP might not be fetched at all.
 *   Therefore, we remove the duplicates after fetching all the elements.
 * - In the deploy phase, we need to deploy these instances as part of the application/SP. They don't have a separate API call.
 */
export const entraApplicationStandaloneFieldsFilter: FilterCreator = ({
  definitions,
  elementSource,
  sharedContext,
}) => ({
  name: 'entraApplicationStandaloneFieldsFilter',
  onFetch: removeDuplicatedInstances,
  deploy: async (changes, changeGroup) => {
    const { deploy, ...otherDefs } = definitions
    if (deploy === undefined) {
      log.error('deploy definitions not found')
      const message = 'Deploy not supported'
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            {
              severity: 'Error',
              message,
              detailedMessage: message,
            },
          ],
        },
        leftoverChanges: changes,
      }
    }
    if (changeGroup === undefined) {
      log.error('change group not provided')
      const message = 'Deploy not supported'
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            {
              severity: 'Error',
              message,
              detailedMessage: message,
            },
          ],
        },
        leftoverChanges: changes,
      }
    }

    const deployChangesFunc: CustomDeployChangesFunc = ({
      changes: adjustedChanges,
      changeGroup: adjustedChangeGroup,
    }) =>
      deployment.deployChanges({
        changes: adjustedChanges,
        changeGroup: adjustedChangeGroup,
        definitions: { deploy, ...otherDefs },
        elementSource,
        convertError: customConvertError,
        changeResolver,
        sharedContext,
      })

    return deployStandaloneFieldsChangesViaParent({
      changes,
      changeGroup,
      elementSource,
      deployChangesFunc,
    })
  },
  onDeploy: addParentIdToChanges,
})
