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

const RELEVANT_TYPE_NAMES = [APP_ROLE_TYPE_NAME, OAUTH2_PERMISSION_SCOPE_TYPE_NAME]

const isInstanceElementOfRelevantTypes = (elem: Element): elem is InstanceElement =>
  isInstanceElement(elem) && RELEVANT_TYPE_NAMES.includes(elem.elemID.typeName)

const isInstanceChangeOfRelevantTypes = (change: Change): change is Change<InstanceElement> =>
  isInstanceElementOfRelevantTypes(getChangeData(change))

const getPermissionScopeFieldPath = (parentTypeName: string): string[] =>
  parentTypeName === APPLICATION_TYPE_NAME
    ? [API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME]
    : [OAUTH2_PERMISSION_SCOPES_FIELD_NAME]

// Remove duplicated instances of EntraAppRole or EntraOAuth2PermissionScope if there are multiple instances with the same elemID
// We prefer to keep the standalone instances with the application parent, if it exists,
// since attempting to deploy it as part of the Service Principal will fail due to inconsistencies with the application.
const removeDuplicatedInstances = async (elements: Element[]): Promise<void> => {
  const potentiallyDuplicatedInstances = elements
    .map((elem, index) => ({ elem, index }))
    .filter(({ elem }) => isInstanceElementOfRelevantTypes(elem))

  const duplicatedInstances = Object.values(
    _.groupBy(potentiallyDuplicatedInstances, ({ elem }) => elem.elemID.getFullName()),
  ).filter(instances => instances.length > 1)

  const instancesToRemove = duplicatedInstances.flatMap(instances => {
    const instanceWithApplicationParentIdx = instances.findIndex(
      ({ elem }) => getParents(elem)[0]?.elemID.typeName === APPLICATION_TYPE_NAME,
    )
    if (instanceWithApplicationParentIdx === -1) {
      // This shouldn't happen, as we expect to find at most 2 similar standalone instances, when one of them has an application parent
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

// Extract unique parents from standalone fields changes.
// If no parent is found, we return an error for each standalone field.
const extractUniqueParentsFromStandaloneFieldsChanges = (
  standaloneFieldsChanges: Change<InstanceElement>[],
): { uniqueParents: InstanceElement[]; errors: SaltoElementError[] } => {
  const parentsOrErrors = standaloneFieldsChanges.map((change): InstanceElement | SaltoElementError => {
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

// Partition changes into:
// - standalone fields changes (changes of EntraAppRole or EntraOAuth2PermissionScope)
// - existing parent changes (changes in the parent of the standalone fields)
// - parents with standalone fields changes (unique parents of standalone fields changes, either with or without changes)
// - other changes (changes that are not standalone fields or their parents)
// - instancesWithNoParentErrors (errors for standalone fields with no parent)
const partitionChanges = (
  changes: Change[],
): {
  standaloneFieldsChanges: Change<InstanceElement>[]
  existingParentChanges: Change<InstanceElement>[]
  parentsWithStandaloneFieldsChanges: InstanceElement[]
  otherChanges: Change[]
  instancesWithNoParentErrors: SaltoElementError[]
} => {
  const [standaloneFieldsChanges, potentialParentChanges] = _.partition(changes, isInstanceChangeOfRelevantTypes)
  const { uniqueParents: parentsWithStandaloneFieldsChanges, errors: instancesWithNoParentErrors } =
    extractUniqueParentsFromStandaloneFieldsChanges(standaloneFieldsChanges)
  const parentsWithStandaloneFieldsChangesFullNames = new Set(
    parentsWithStandaloneFieldsChanges.map(parent => parent.elemID.getFullName()),
  )
  const [existingParentChanges, otherChanges] = _.partition(
    potentialParentChanges,
    (change): change is Change<InstanceElement> =>
      isInstanceChange(change) &&
      parentsWithStandaloneFieldsChangesFullNames.has(getChangeData(change).elemID.getFullName()),
  )

  return {
    standaloneFieldsChanges,
    existingParentChanges,
    parentsWithStandaloneFieldsChanges,
    otherChanges,
    instancesWithNoParentErrors,
  }
}

// We must specify an id for each standalone field on the creation request.
// We should also make sure to manually set the same id for their corresponding changes, to update the nacls properly.
const addIdToStandaloneFields = ({
  standaloneFieldsChanges,
  standaloneFieldsInstances,
}: {
  standaloneFieldsChanges: Change<InstanceElement>[]
  standaloneFieldsInstances: InstanceElement[]
}): void => {
  const instanceNameToInternalId = new Map<string, string>()

  standaloneFieldsChanges.forEach(change => {
    const changeData = getChangeData(change)
    if (change.action === 'add') {
      const id = uuid4()
      instanceNameToInternalId.set(changeData.elemID.getFullName(), id)
      changeData.value.id = id
    }
  })

  standaloneFieldsInstances.forEach(standaloneField => {
    if (standaloneField.value.id === undefined) {
      standaloneField.value.id = instanceNameToInternalId.get(standaloneField.elemID.getFullName())
    }
  })
}

// Update the parent change with the standalone fields.
// The standalone fields are deployed as part of the parent, so we need to include them in the parent change.
const updateParentChangeWithStandaloneFields = ({
  parentChange,
  standaloneFields,
}: {
  parentChange: Change<InstanceElement>
  standaloneFields: InstanceElement[]
}): void => {
  const parent = getChangeData(parentChange)
  const [appRoleInstances, permissionScopeInstances] = _.partition(
    standaloneFields,
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
          const referencedPermission = permissionScopeInstances.find(
            permission => permission.elemID.getFullName() === ref.value.elemID.getFullName(),
          )
          if (referencedPermission === undefined) {
            log.error('Failed to find permission with elemID %s', ref.value.elemID.getFullName())
            return
          }
          ref.value.value.id = referencedPermission.value.id
        }
      }
    })
  })
}

// The standalone fields are added to the parent change in place, but they shouldn't be included in the applied change to avoid modifying the nacls.
// Using the original change isn't an option because the applied changes may include the id returned from the service, which we want to retain.
const revertChangesToParent = (parentChange: Change): void => {
  if (!isInstanceChange(parentChange)) {
    log.error('Expected parent change to be an instance change, but got %o', parentChange)
    return
  }

  if (isRemovalChange(parentChange)) {
    return
  }

  applyFunctionToChangeDataSync(parentChange, instance => {
    instance.value = _.omit(instance.value, [
      APP_ROLES_FIELD_NAME,
      getPermissionScopeFieldPath(instance.elemID.typeName).join('.'),
    ])
    if (instance.value[API_FIELD_NAME] !== undefined && _.isEmpty(instance.value[API_FIELD_NAME])) {
      delete instance.value[API_FIELD_NAME]
    }
    return instance
  })
}

// Calculate the changes to deploy:
// The standalone fields are deployed as part of the parent, so we need to include them in the parent change.
// We either modify the existing parent change or create a new (modification) one if there isn't a change for the parent.
const getChangesToDeploy = async ({
  standaloneFieldsChanges,
  existingParentChanges,
  parentsWithStandaloneFieldsChanges,
  elementSource,
}: {
  standaloneFieldsChanges: Change<InstanceElement>[]
  existingParentChanges: Change<InstanceElement>[]
  parentsWithStandaloneFieldsChanges: InstanceElement[]
  elementSource: ReadOnlyElementsSource
}): Promise<Change<InstanceElement>[]> => {
  const allParentsToStandaloneFields = _.groupBy(
    await getInstancesFromElementSource(elementSource, RELEVANT_TYPE_NAMES),
    // If no parent is found:
    // - If there's a change for the standalone field, we already return deploy error (calculated in extractUniqueParentsFromStandaloneFieldsChanges)
    // - If there's no change for the standalone field, we ignore it.
    elem => getParents(elem)[0]?.elemID.getFullName(),
  )
  const relevantParentsFullNames = new Set(
    parentsWithStandaloneFieldsChanges.map(parent => parent.elemID.getFullName()),
  )
  const relevantParentToStandaloneFields = _.pickBy(allParentsToStandaloneFields, (_instances, parentFullName) =>
    relevantParentsFullNames.has(parentFullName),
  )
  const clonedParentToStandaloneFields = _.mapValues(relevantParentToStandaloneFields, instances =>
    instances.map(instance => instance.clone()),
  )

  addIdToStandaloneFields({
    standaloneFieldsInstances: Object.values(clonedParentToStandaloneFields).flat(),
    standaloneFieldsChanges,
  })

  const fullNamesToExistingParentChanges = Object.fromEntries(
    existingParentChanges.map(change => [getChangeData(change).elemID.getFullName(), change]),
  )
  const parentChangesToDeploy = parentsWithStandaloneFieldsChanges
    .map(parent => {
      const parentChange = fullNamesToExistingParentChanges[parent.elemID.getFullName()] ?? {
        action: 'modify' as const,
        data: {
          before: parent,
          after: parent.clone(),
        },
      }
      if (isRemovalChange(parentChange)) {
        // No need to update the parent change with the standalone fields, since it's a removal change, and the standalone fields will be removed as well.
        return parentChange
      }

      updateParentChangeWithStandaloneFields({
        parentChange,
        standaloneFields: clonedParentToStandaloneFields[parent.elemID.getFullName()] ?? [],
      })

      return parentChange
    })
    .filter(isDefined)

  return parentChangesToDeploy
}

// Calculate the deploy result:
// The deploy request only includes the parent changes, so we need to add the standalone fields changes to the result, if their parent change was applied.
// We also need to filter applied parent changes that didn't originally have changes.
const calculateDeployResult = ({
  deployResult: { errors, appliedChanges: appliedParentChanges },
  standaloneFieldsChanges,
  existingParentChanges,
  instancesWithNoParentErrors,
}: {
  deployResult: DeployResult
  standaloneFieldsChanges: Change<InstanceElement>[]
  existingParentChanges: Change<InstanceElement>[]
  instancesWithNoParentErrors: SaltoElementError[]
}): DeployResult => {
  const existingParentChangesFullNames = new Set(
    existingParentChanges.map(change => getChangeData(change).elemID.getFullName()),
  )
  const appliedExistingParentChanges = appliedParentChanges.filter(change =>
    existingParentChangesFullNames.has(getChangeData(change).elemID.getFullName()),
  )

  const appliedParentChangesFullNames = new Set(
    appliedParentChanges.map(change => getChangeData(change).elemID.getFullName()),
  )
  const appliedStandaloneFieldsChanges = standaloneFieldsChanges.filter(change =>
    appliedParentChangesFullNames.has(getParents(getChangeData(change))[0]?.elemID.getFullName()),
  )

  return {
    errors: errors.concat(instancesWithNoParentErrors),
    appliedChanges: appliedExistingParentChanges.concat(appliedStandaloneFieldsChanges),
  }
}

/*
 * Add parent_id to the newly added standalone fields.
 * This is needed to ensure uniqueness in serviceId for those fields, whose IDs uniqueness is parent-contextual.
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
 * Handles the duplications & deployment of 2 standalone fields extracted from the application/service principal:
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

    const {
      standaloneFieldsChanges,
      existingParentChanges,
      parentsWithStandaloneFieldsChanges,
      otherChanges,
      instancesWithNoParentErrors,
    } = partitionChanges(changes)

    const changesToDeploy = await getChangesToDeploy({
      standaloneFieldsChanges,
      existingParentChanges,
      parentsWithStandaloneFieldsChanges,
      elementSource,
    })

    if (changesToDeploy.length === 0) {
      return {
        deployResult: {
          appliedChanges: [],
          errors: instancesWithNoParentErrors,
        },
        leftoverChanges: otherChanges,
      }
    }

    const deployResult = await deployment.deployChanges({
      changes: changesToDeploy,
      changeGroup: {
        ...changeGroup,
        changes: changesToDeploy,
      },
      definitions: { deploy, ...otherDefs },
      elementSource,
      sharedContext,
      convertError: customConvertError,
      changeResolver,
    })

    deployResult.appliedChanges.forEach(revertChangesToParent)

    const deployResultWithStandaloneFields = calculateDeployResult({
      deployResult,
      standaloneFieldsChanges,
      existingParentChanges,
      instancesWithNoParentErrors,
    })

    return {
      deployResult: deployResultWithStandaloneFields,
      leftoverChanges: otherChanges,
    }
  },
  onDeploy: addParentIdToChanges,
})
