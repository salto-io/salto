/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { v4 as uuid4 } from 'uuid'
import { values, collections } from '@salto-io/lowerdash'
import {
  Change,
  ChangeGroup,
  DeployResult,
  Element,
  InstanceElement,
  ReadOnlyElementsSource,
  SaltoElementError,
  getChangeData,
  isInstanceChange,
  isInstanceElement,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, getInstancesFromElementSource, getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { deployment } from '@salto-io/adapter-components'
import { APP_ROLE_TYPE_NAME, APP_ROLES_FIELD_NAME, APPLICATION_TYPE_NAME } from '../constants'
import { FilterCreator } from '../definitions/types'
import { changeResolver } from '../definitions/references'
import { customConvertError } from '../error_utils'

const log = logger(module)
const { isDefined } = values
const { awu } = collections.asynciterable

// We remove the changes from the array in reverse order to avoid changing the indices of the elements we still need to remove
const removeArrayElementsByIndices = (arr: unknown[], indicesToRemove: number[]): void => {
  indicesToRemove.sort((a, b) => b - a).forEach(index => arr.splice(index, 1))
}

type CustomDeployChangesFunc = (params: {
  changes: Change<InstanceElement>[]
  changeGroup: ChangeGroup
}) => Promise<DeployResult>

type DeployResultWithLeftoverChanges = { deployResult: DeployResult; leftoverChanges: Change[] }

const isAppRoleInstanceElement = (elem: Element): elem is InstanceElement =>
  isInstanceElement(elem) && elem.elemID.typeName === APP_ROLE_TYPE_NAME

const isAppRoleInstanceChange = (change: Change): change is Change<InstanceElement> =>
  isAppRoleInstanceElement(getChangeData(change))

const removeDuplicatedAppRoles = async (elements: Element[]): Promise<void> => {
  const appRoleInstancesWithIndices = elements
    .map((elem, index) => ({ elem, index }))
    .filter(({ elem }) => isAppRoleInstanceElement(elem))

  const elemIdToAppRoles = _.groupBy(appRoleInstancesWithIndices, ({ elem }) => elem.elemID.getFullName())
  const appRolesToRemove = Object.values(elemIdToAppRoles)
    .filter(appRoles => appRoles.length > 1)
    .flatMap(appRoles => {
      // We prefer to keep the app role with the application parent, if it exists,
      // since attempting to deploy it as part of the SP will fail due to inconsistencies with the application.
      const appRoleWithApplicationParentIdx = appRoles.findIndex(
        ({ elem }) => getParents(elem)[0]?.elemID.typeName === APPLICATION_TYPE_NAME,
      )
      if (appRoleWithApplicationParentIdx === -1) {
        // This shouldn't happen, as we expect to find at most 2 similar app roles, when one of them has an application parent
        log.warn('Found multiple app roles with the same elemID, but none of them have an application parent')
        // Arbitrarily remove all but the first
        return appRoles.slice(1)
      }
      return appRoles.filter((_appRole, index) => index !== appRoleWithApplicationParentIdx)
    })

  log.trace(
    'Removing the following app roles: %s',
    appRolesToRemove.map(({ elem }) => elem.elemID.getFullName()).join(', '),
  )
  removeArrayElementsByIndices(
    elements,
    appRolesToRemove.map(({ index }) => index),
  )
}

const extractUniqueParentsFromAppRoleChanges = (
  appRoleChanges: Change<InstanceElement>[],
): { uniqueParents: InstanceElement[]; errors: SaltoElementError[] } => {
  const parentsOrErrors = appRoleChanges.map((change): InstanceElement | SaltoElementError => {
    const parent = getParents(getChangeData(change))[0]?.value
    if (parent === undefined || !isInstanceElement(parent)) {
      log.error(
        'App role %s has no parent or its parent is not an instance element',
        getChangeData(change).elemID.getFullName(),
      )
      const message = 'Expected app role to have an application or service principal parent'
      return {
        elemID: getChangeData(change).elemID,
        message,
        detailedMessage: message,
        severity: 'Error',
      }
    }
    return parent
  })
  const [parents, errors] = _.partition(parentsOrErrors, isInstanceElement)
  return {
    // We use 'fromEntries' as a "trick" to save each parent only once, without actually comparing the objects
    uniqueParents: Object.values(Object.fromEntries(parents.map(parent => [parent.elemID.getFullName(), parent]))),
    errors,
  }
}

const addAppRoleIdToAppRole = (
  appRole: InstanceElement,
  appRoleNameToInternalId: Record<string, string>,
): InstanceElement => {
  if (appRole.value.id === undefined) {
    appRole.value.id = appRoleNameToInternalId[appRole.elemID.getFullName()]
  }
  return appRole
}

const groupAppRolesByParent = async (
  elementSource: ReadOnlyElementsSource,
  appRoleNameToInternalId: Record<string, string>,
): Promise<Record<string, InstanceElement[]>> =>
  _.groupBy(
    (await getInstancesFromElementSource(elementSource, [APP_ROLE_TYPE_NAME])).map(appRole =>
      addAppRoleIdToAppRole(appRole, appRoleNameToInternalId),
    ),
    // If no parent is found & the app role is not part of the received changes, we will just skip it
    elem => getParents(elem)[0]?.elemID.getFullName(),
  )

const setOrCreateParentChangeWithAppRoles = async ({
  parent,
  otherChanges,
  parentToAppRolesMap,
}: {
  parent: InstanceElement
  otherChanges: Change[]
  parentToAppRolesMap: Record<string, InstanceElement[]>
}): Promise<
  | {
      parentChange: Change<InstanceElement>
      existingParentChangeIdx: number | undefined
    }
  | undefined
> => {
  const parentFullName = parent.elemID.getFullName()
  const parentChangeIdx = otherChanges.findIndex(
    change => getChangeData(change).elemID.getFullName() === parentFullName,
  )
  const existingParentChangeIdx = parentChangeIdx !== -1 ? parentChangeIdx : undefined
  const existingParentChange = existingParentChangeIdx !== undefined ? otherChanges[existingParentChangeIdx] : undefined
  if (existingParentChange !== undefined) {
    // We shouldn't really reach this point, as we validate the parent in 'extractUniqueParentsFromAppRoleChanges', but just for TS to be happy
    if (!isInstanceChange(existingParentChange)) {
      log.error('Parent %s is not an instance change, skipping its app roles deployment', parentFullName)
      return undefined
    }

    if (isRemovalChange(existingParentChange)) {
      // We deploy removal changes through the filter as well, so we will know whether the app role changes should be marked as applied or not
      return { parentChange: existingParentChange, existingParentChangeIdx }
    }
  }

  const parentChange = existingParentChange ?? {
    action: 'modify',
    data: {
      before: parent,
      after: parent.clone(),
    },
  }

  parentChange.data.after.value[APP_ROLES_FIELD_NAME] = parentToAppRolesMap[parentFullName].map(
    appRole => appRole.value,
  )
  return {
    parentChange,
    existingParentChangeIdx,
  }
}

const deployAppRoleChangesViaParent = async ({
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
  const [appRoleInstanceChanges, otherChanges] = _.partition(changes, isAppRoleInstanceChange)
  const { uniqueParents, errors: appRoleWithNoParentErrors } =
    extractUniqueParentsFromAppRoleChanges(appRoleInstanceChanges)

  // We must specify an id for each appRole on addition.
  // Since they're not deployed on their own we should also make sure to update the relevant changes with the id we generate.
  const appRoleNameToInternalId = Object.fromEntries(
    appRoleInstanceChanges.map(change => [
      getChangeData(change).elemID.getFullName(),
      getChangeData(change).value.id ?? uuid4(),
    ]),
  )
  const parentToAppRolesMap = await groupAppRolesByParent(elementSource, appRoleNameToInternalId)
  const parentChanges = (
    await Promise.all(
      uniqueParents.map(parent =>
        setOrCreateParentChangeWithAppRoles({
          parent,
          parentToAppRolesMap,
          otherChanges,
        }),
      ),
    )
  ).filter(isDefined)

  const existingParentChangeIndices = parentChanges
    .map(({ existingParentChangeIdx }) => existingParentChangeIdx)
    .filter(isDefined)
  removeArrayElementsByIndices(otherChanges, existingParentChangeIndices)
  const changesToDeploy = parentChanges.map(({ parentChange }) => parentChange)

  const calculateResult = async ({
    errors,
    appliedChanges: appliedParentChanges,
  }: DeployResult): Promise<DeployResultWithLeftoverChanges> => {
    const appliedParentChangesFullNames = appliedParentChanges.map(change => getChangeData(change).elemID.getFullName())
    const appliedExistingParentChanges = await awu(parentChanges)
      .filter(
        ({ parentChange, existingParentChangeIdx }) =>
          existingParentChangeIdx !== undefined &&
          appliedParentChangesFullNames.includes(getChangeData(parentChange).elemID.getFullName()),
      )
      .map(({ parentChange }) =>
        // We add the app roles field to the parent change in place, but we don't include it in the applied change.
        // So we remove it before returning it as an applied change.
        // The reason we modify the change in place is that the `copy from response` flow works on the original change,
        // and in case where we add an application we need to copy its id and appId.
        applyFunctionToChangeData(parentChange, instance => {
          instance.value = _.omit(instance.value, APP_ROLES_FIELD_NAME)
          return instance
        }),
      )
      .toArray()
    const appliedAppRoleChanges = await awu(appRoleInstanceChanges)
      .filter(change =>
        appliedParentChangesFullNames.includes(getParents(getChangeData(change))[0]?.elemID.getFullName()),
      )
      .map(change =>
        applyFunctionToChangeData(change, instance => addAppRoleIdToAppRole(instance, appRoleNameToInternalId)),
      )
      .toArray()

    return {
      deployResult: {
        errors: errors.concat(appRoleWithNoParentErrors),
        appliedChanges: appliedExistingParentChanges.concat(appliedAppRoleChanges),
      },
      leftoverChanges: otherChanges,
    }
  }

  if (_.isEmpty(changesToDeploy)) {
    return calculateResult({ errors: [], appliedChanges: [] })
  }

  const deployResult = await deployChangesFunc({
    changes: changesToDeploy,
    changeGroup: {
      ...changeGroup,
      changes: changesToDeploy,
    },
  })

  return calculateResult(deployResult)
}

/**
 * Handles app role duplications + deployment
 * We set the app roles field in the application/service principal as top level in order to be able to reference it.
 * However, it creates a problem both in the fetch and deploy phases:
 * - In the fetch phase, the app roles can be retrieved either from the application or from the service principal, with the same values.
 *   We cannot filter them in advance (i.e. fetch only the application's/SP's app roles), since the application/SP might not be fetched at all.
 *   Therefore, we remove the duplicates after fetching all the elements.
 * - In the deploy phase, we need to deploy the app roles as part of the application/SP. They don't have a separate API call.
 */
export const appRolesFilter: FilterCreator = ({ definitions, elementSource, sharedContext }) => ({
  name: 'appRolesFilter',
  onFetch: removeDuplicatedAppRoles,
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

    return deployAppRoleChangesViaParent({
      changes,
      changeGroup,
      elementSource,
      deployChangesFunc,
    })
  },
})
