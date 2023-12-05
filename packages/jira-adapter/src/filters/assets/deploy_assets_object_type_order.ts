/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { getChangeData, isAdditionChange, isInstanceChange, isModificationChange, isReferenceExpression, ReferenceExpression, SaltoError } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { deployChanges } from '../../deployment/standard_deployment'
import { FilterCreator } from '../../filter'
import { ASSETS_OBJECT_TYPE, ASSETS_OBJECT_TYPE_ORDER_TYPE } from '../../constants'
import { getWorkspaceId } from '../../workspace_id'
import JiraClient from '../../client/client'

const { awu } = collections.asynciterable
const log = logger(module)

const sendRequest = async ({
  client, workspaceId, position, toObjectTypeId, assetsObjectType,
}: {
  client: JiraClient
  workspaceId: string
  position: number
  toObjectTypeId?: string
  assetsObjectType: ReferenceExpression
}):
Promise<void> => {
  const { id } = assetsObjectType.value.value
  const data = toObjectTypeId === undefined ? { position } : { position, toObjectTypeId }
  const url = `/gateway/api/jsm/assets/workspace/${workspaceId}/v1/objecttype/${id}/position`
  await client.post({ url, data })
}
/**
 * Handles the assetsObjectTypes order inside each assets objectType
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'deployAssetsObjectTypeOrderFilter',
  /* changes the position for all objectTypes that needed to be change */
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ASSETS_OBJECT_TYPE_ORDER_TYPE
    )
    const workspaceId = await getWorkspaceId(client)
    if (workspaceId === undefined) {
      log.error(`Skip deployment of ${ASSETS_OBJECT_TYPE_ORDER_TYPE} types because workspaceId is undefined`)
      const error: SaltoError = {
        message: `The following changes were not deployed, due to error with the workspaceId: ${relevantChanges.map(c => getChangeData(c).elemID.getFullName()).join(', ')}`,
        severity: 'Error',
      }
      return {
        deployResult: { appliedChanges: [], errors: [error] },
        leftoverChanges,
      }
    }
    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => {
        const instance = getChangeData(change)
        const parent = getParent(instance)
        const toObjectTypeId = parent.elemID.typeName === ASSETS_OBJECT_TYPE ? parent.value.id : undefined
        if (isAdditionChange(change)) {
          await awu(instance.value.objectTypes).filter(isReferenceExpression)
            .forEach(async (assetsObjectType, position) => {
              await sendRequest({
                client, workspaceId, position, toObjectTypeId, assetsObjectType,
              })
            })
        }
        if (isModificationChange(change)) {
          const positionsBefore = change.data.before.value.objectTypes
          await awu(instance.value.objectTypes).filter(isReferenceExpression)
            .forEach(async (assetsObjectType, position) => {
              if (positionsBefore[position]?.elemID.getFullName() !== assetsObjectType.elemID.getFullName()) {
                await sendRequest({
                  client, workspaceId, position, toObjectTypeId, assetsObjectType,
                })
              }
            })
        }
      }
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
