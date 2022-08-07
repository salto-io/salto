/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, Element, isInstanceElement, isInstanceChange, getChangeData, Change, InstanceElement, isAdditionOrModificationChange, DeployResult, isModificationChange, AdditionChange, ModificationChange, Values, isReferenceExpression, isAdditionChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { STATUS_TYPE_NAME } from '../../constants'
import JiraClient from '../../client/client'

const log = logger(module)
const STATUS_CATEGORY_NAME_TO_ID : Record<string, number> = {
  TODO: 2,
  DONE: 3,
  IN_PROGRESS: 4,
}
const STATUS_DEPLOYMENT_LIMIT = 50

const createDeployableStatusValues = (
  statusChanges: Array<Change<InstanceElement>>
): Values[] => statusChanges
  .map(getChangeData)
  .map(instance => instance.value)
  .map(value => {
    const deployableValue = _.clone(value)
    if (isReferenceExpression(value.statusCategory)) {
      // resolve statusCategory value before deploy
      const resolvedCategory = _.invert(STATUS_CATEGORY_NAME_TO_ID) [
        value.statusCategory.value.value.id
      ]
      deployableValue.statusCategory = resolvedCategory
    }
    return deployableValue
  })

const setStatusIds = (
  changes: Array<AdditionChange<InstanceElement>>,
  response: clientUtils.ResponseValue[],
): void => {
  changes
    .map(getChangeData)
    .forEach(instance => {
      const responseValue = response.find(r => r.name === instance.value.name)
      if (responseValue !== undefined) {
        instance.value.id = responseValue.id
      }
    })
}

const modifyStatuses = async (
  modificationChanges: Array<ModificationChange<InstanceElement>>,
  client: JiraClient,
): Promise<void> => {
  await client.put({
    url: '/rest/api/3/statuses',
    data: {
      statuses: createDeployableStatusValues(modificationChanges),
    },
  })
}

const addStatuses = async (
  additionChanges: Array<AdditionChange<InstanceElement>>,
  client: JiraClient,
): Promise<void> => {
  const response = await client.post({
    url: '/rest/api/3/statuses',
    data: {
      scope: {
        type: 'GLOBAL',
      },
      statuses: createDeployableStatusValues(additionChanges),
    },
  })
  setStatusIds(additionChanges, response.data as clientUtils.ResponseValue[])
}

const deployStatuses = async (
  changes: Array<AdditionChange<InstanceElement> | ModificationChange<InstanceElement>>,
  client: JiraClient,
): Promise<DeployResult> => {
  const deployErrors: Error[] = []

  await Promise.all(
    _.chunk(changes, STATUS_DEPLOYMENT_LIMIT)
      .map(async statusChangesChunk => {
        try {
          const [modificationChanges, additionChanges] = _.partition(
            changes,
            change => isModificationChange(change),
          )

          if (modificationChanges.length > 0) {
            await modifyStatuses(
              statusChangesChunk.filter(isModificationChange),
              client
            )
          }

          if (additionChanges.length > 0) {
            await addStatuses(
              statusChangesChunk.filter(isAdditionChange),
              client
            )
          }
        } catch (err) {
          _.pullAll(changes, statusChangesChunk)
          deployErrors.push(err)
        }
      })
  )

  return {
    appliedChanges: changes,
    errors: deployErrors,
  }
}

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === STATUS_TYPE_NAME)
      .filter(instance => instance.value.statusCategory !== undefined)
      .forEach(instance => {
        // statusCategory has a fixed number of options so we map the statusCategory name to its id
        instance.value.statusCategory = STATUS_CATEGORY_NAME_TO_ID[instance.value.statusCategory]
        ?? instance.value.statusCategory
      })

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping status deployment filter because private API is not enabled')
      return
    }

    const statusType = findObject(elements, STATUS_TYPE_NAME)
    if (statusType === undefined) {
      return
    }

    statusType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    statusType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    statusType.annotations[CORE_ANNOTATIONS.DELETABLE] = true
    setFieldDeploymentAnnotations(statusType, 'statusCategory')
    setFieldDeploymentAnnotations(statusType, 'description')
    setFieldDeploymentAnnotations(statusType, 'name')
    setFieldDeploymentAnnotations(statusType, 'id')
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === STATUS_TYPE_NAME
    )

    if (relevantChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: {
          errors: [],
          appliedChanges: [],
        },
      }
    }

    const deployResult = await deployStatuses(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange),
      client,
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
