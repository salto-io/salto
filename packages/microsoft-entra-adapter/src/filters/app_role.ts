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
import { Change, Element, InstanceElement, getChangeData } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { createChangeElementResolver, deployment, references } from '@salto-io/adapter-components'
import { APP_ROLE_TYPE_NAME, APPLICATION_TYPE_NAME } from '../constants'
import { FilterCreator } from '../definitions/types'

const log = logger(module)

/**
 * Handle app roles with the same elemID // TODO explain more
 */
export const appRolesFilter: FilterCreator = ({ definitions, elementSource, sharedContext }) => ({
  name: 'appRolesFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const appRoleInstancesWithIndices = elements
      .map((elem, index) => ({ elem, index }))
      .filter(({ elem }) => elem.elemID.typeName === APP_ROLE_TYPE_NAME)

    const elemIdToAppRoles = _.groupBy(appRoleInstancesWithIndices, ({ elem }) => elem.elemID.getFullName())
    const appRolesToRemove = Object.values(elemIdToAppRoles)
      .filter(appRoles => appRoles.length > 1)
      .flatMap(appRoles => {
        const appRoleWithApplicationParentIdx = appRoles.findIndex(
          ({ elem }) => getParent(elem).elemID.typeName === APPLICATION_TYPE_NAME,
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
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            {
              severity: 'Error',
              message: 'missing deploy definitions',
            },
          ],
        },
        leftoverChanges: changes,
      }
    }
    if (changeGroup === undefined) {
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            {
              severity: 'Error',
              message: 'change group not provided',
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
      change => getChangeData(change).elemID.typeName === APP_ROLE_TYPE_NAME,
    )

    const appRoleChangesWithParent = appRoleChanges.map(change => ({
      change,
      parent: getParent(getChangeData(change)),
    }))
    const parentToAppRoles = _.groupBy(appRoleChangesWithParent, ({ parent }) => parent.elemID.getFullName())
    const parentWithResolvedAppRoles = Object.values(parentToAppRoles)

    const deployResults = await Promise.all(
      relevantChanges.map(async (change): Promise<DeployResult> => {
        const changeData = getChangeData(change)
        const topLevelDeployResult = await deployment.deployChanges({
          changes: [change],
          ...deployArgsWithoutChanges,
        })
        if (!_.isEmpty(topLevelDeployResult.errors)) {
          return topLevelDeployResult
        }

        log.debug(
          'successfully deployed %s, starting to deploy %s',
          changeData.elemID.getFullName(),
          arrayFieldDefinition,
        )
        return deployArrayField({
          change,
          ...deployArgsWithoutChanges,
          arrayFieldDefinitionsWithTopLevel: {
            ...arrayFieldDefinition,
            adapterName: specificTypeParams.adapterName,
            topLevelTypeName,
          },
        })
      }),
    )
    return {
      deployResult: {
        appliedChanges: deployResults.flatMap(r => r?.appliedChanges ?? []),
        errors: deployResults.flatMap(r => r?.errors ?? []),
      },
      leftoverChanges: otherChanges,
    }
  },
})
