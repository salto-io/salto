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
import { collections, values } from '@salto-io/lowerdash'
import {
  AdditionChange,
  Change,
  Element,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { getParent, getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { createChangeElementResolver, deployment, references } from '@salto-io/adapter-components'
import { APP_ROLE_TYPE_NAME, APP_ROLES_FIELD_NAME, APPLICATION_TYPE_NAME } from '../constants'
import { FilterCreator } from '../definitions/types'

const log = logger(module)
const { awu } = collections.asynciterable
const { isDefined } = values

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
  onFetch: async (elements: Element[]): Promise<void> => {
    const appRoleInstancesWithIndices = elements
      .map((elem, index) => ({ elem, index }))
      .filter(({ elem }) => isInstanceElement(elem) && elem.elemID.typeName === APP_ROLE_TYPE_NAME)

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
    // We remove the app roles in reverse order to avoid changing the indices of the elements we still need to remove
    const indicesToRemove = appRolesToRemove.map(({ index }) => index).sort((a, b) => b - a)
    indicesToRemove.forEach(index => elements.splice(index, 1))
  },
  deploy: async (changes, changeGroup) => {
    const { deploy, ...otherDefs } = definitions
    if (deploy === undefined) {
      log.error('deploy definitions not found')
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            {
              severity: 'Error',
              message: 'Deploy not supported',
            },
          ],
        },
        leftoverChanges: changes,
      }
    }
    if (changeGroup === undefined) {
      log.error('change group not provided')
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            {
              severity: 'Error',
              message: 'Deploy not supported',
            },
          ],
        },
        leftoverChanges: changes,
      }
    }

    const deployArgsWithoutChanges = {
      definitions: { deploy, ...otherDefs },
      changeGroup,
      elementSource,
      convertError: deployment.defaultConvertError,
      changeResolver: createChangeElementResolver<Change<InstanceElement>>({
        getLookUpName: references.generateLookupFunc(definitions.references?.rules ?? []),
      }),
      sharedContext,
    }

    const [appRoleChanges, otherChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === APP_ROLE_TYPE_NAME,
    ) as [Change<InstanceElement>[], Change[]]

    // We use 'fromEntries' as a "trick" to save each parent only once, without actually comparing the objects
    const parentsWithAppRoleChanges = Object.fromEntries(
      appRoleChanges
        .map((change): [string, InstanceElement] | undefined => {
          const parent = getParents(getChangeData(change))[0]?.value
          return parent ? [parent.elemID.getFullName(), parent] : undefined
        })
        .filter(isDefined),
    )
    const allAppRoleInstancesWithParentName = awu(await elementSource.getAll())
      .filter((elem): elem is InstanceElement => elem.elemID.typeName === APP_ROLE_TYPE_NAME && isInstanceElement(elem))
      .map(elem => ({
        elem,
        parentName: getParents(elem)[0]?.elemID.getFullName(),
      }))
    const parentsOriginalChange: Change[] = []
    const parentsChangeWithAppRoles = await Promise.all(
      Object.entries(parentsWithAppRoleChanges).map(
        async ([parentFullName, parent]): Promise<
          AdditionChange<InstanceElement> | ModificationChange<InstanceElement> | undefined
        > => {
          const parentExistingChangeIdx = otherChanges.findIndex(
            change => getChangeData(change).elemID.getFullName() === parentFullName,
          )
          const parentExistingChange =
            parentExistingChangeIdx !== -1 ? otherChanges[parentExistingChangeIdx] : undefined
          if (parentExistingChange !== undefined) {
            parentsOriginalChange.push(parentExistingChange)
            otherChanges.splice(parentExistingChangeIdx, 1)
          }
          if (parentExistingChange && !isInstanceChange(parentExistingChange)) {
            log.error('Parent %s is not an instance change, skipping its app roles deployment', parentFullName)
            return undefined
          }
          const parentChange = parentExistingChange ?? {
            action: 'modify',
            data: {
              before: parent,
              after: parent,
            },
          }
          if (!isAdditionOrModificationChange(parentChange)) {
            log.debug('Parent %s is a deletion change, skipping app roles deployment', parentFullName)
            return undefined
          }

          const applyFunction = async (instance: InstanceElement): Promise<InstanceElement> => {
            const instanceDup = instance.clone()
            instanceDup.value[APP_ROLES_FIELD_NAME] = await allAppRoleInstancesWithParentName
              .filter(({ parentName }) => parentName === parentFullName)
              .map(({ elem }) => elem.value)
              .toArray()
            return instanceDup
          }

          if (isAdditionChange(parentChange)) {
            return {
              ...parentChange,
              data: {
                after: await applyFunction(parentChange.data.after),
              },
            }
          }

          return {
            ...parentChange,
            data: {
              ...parentChange.data,
              after: await applyFunction(parentChange.data.after),
            },
          }
        },
      ),
    )

    const changesToDeploy = parentsChangeWithAppRoles.filter(isDefined)
    if (_.isEmpty(changesToDeploy)) {
      return {
        deployResult: {
          errors: [],
          appliedChanges: [],
        },
        leftoverChanges: changes,
      }
    }

    const { errors, appliedChanges } = await deployment.deployChanges({
      changes: parentsChangeWithAppRoles.filter(isDefined),
      ...deployArgsWithoutChanges,
    })
    return {
      deployResult: {
        errors,
        appliedChanges: parentsOriginalChange.concat(
          appRoleChanges.filter(change =>
            appliedChanges.some(
              appliedChange =>
                getChangeData(appliedChange).elemID.getFullName() ===
                getParent(getChangeData(change)).elemID.getFullName(),
            ),
          ),
        ),
      },
      leftoverChanges: otherChanges,
    }
  },
})
