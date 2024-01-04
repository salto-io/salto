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

import { config as configUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { AdditionChange, Change, DeployResult, InstanceElement, createSaltoElementError, getChangeData, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isReferenceExpression, isRemovalChange, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FilterCreator } from '../../filter'
import { OBJECT_TYPE_ATTRIBUTE_TYPE } from '../../constants'
import { getWorkspaceId } from '../../workspace_id'
import JiraClient from '../../client/client'

const log = logger(module)

type AttributeParams = {
  id: string
  name: string
  editable: boolean
}

type AttributeGetResponse = AttributeParams[]

export const DEFAULT_ATTRIBUTES = ['Key', 'Created', 'Updated']

const ATTRIBUTE_RESOPNSE_SCHEME = Joi.array().items(Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
}).unknown(true)).required()

const isAttributeResponse = createSchemeGuard<AttributeGetResponse>(ATTRIBUTE_RESOPNSE_SCHEME)

const getExsitingAttributesNamesAndIds = async (
  changes: AdditionChange<InstanceElement>[],
  client: JiraClient,
  workspaceId: string,
):Promise<string[][]> => {
  try {
    const objectType = changes[0].data.after.value.objectType?.value
    const response = await client.getSinglePage({
      url: `/gateway/api/jsm/assets/workspace/${workspaceId}/v1/objecttype/${objectType.value.id}/attributes`,
    })
    if (!isAttributeResponse(response.data)) {
      return []
    }
    const editableExistingAttributes = response.data
      .filter(attribute => attribute.editable)
      .map(attribute => [attribute.name, attribute.id])
    return editableExistingAttributes
  } catch (e) {
    log.error(`failed to get existing attributes due to an error ${e}`)
    return []
  }
}

/*
* This function is used to handle the case where a default attribute is added
* and we want to deploy it as a modification change since it already exists in the service.
*/
const attributeAdditionOrModification = (
  change: Change<InstanceElement>,
  objectTypeToEditableExistiningAttributes: Record<string, string[][]>,
): Change<InstanceElement> => {
  if (!isAdditionChange(change)) {
    return change
  }
  const instance = getChangeData(change)
  const objectType = instance.value.objectType.elemID.getFullName()
  const existingAttributes = Object.fromEntries(objectTypeToEditableExistiningAttributes[objectType])
  if (existingAttributes !== undefined && Object.keys(existingAttributes).includes(instance.value.name)) {
    change.data.after.value.id = existingAttributes[change.data.after.value.name]
    const emptyAttributeInstance = change.data.after.clone()
    emptyAttributeInstance.value = {}
    return toChange({ before: emptyAttributeInstance, after: change.data.after })
  }
  return change
}

const deployAttributeChanges = async ({
  jsmApiDefinitions,
  changes,
  client,
  workspaceId,
  objectTypeToEditableExistiningAttributes,
}: {
  jsmApiDefinitions: configUtils.AdapterDuckTypeApiConfig
  changes: Change<InstanceElement>[]
  client: JiraClient
  workspaceId: string
  objectTypeToEditableExistiningAttributes: Record<string, string[][]>
}): Promise<Omit<DeployResult, 'extraProperties'>> => {
  const additionalUrlVars = { workspaceId }
  return deployChanges(
    changes,
    async change => {
      if (DEFAULT_ATTRIBUTES.includes(getChangeData(change).value.name)) {
        return
      }
      if (isRemovalChange(change) && getChangeData(change).value.name === 'Name') {
        return
      }
      const instance = getChangeData(change)
      const modifiedChange = attributeAdditionOrModification(change, objectTypeToEditableExistiningAttributes)
      await defaultDeployChange({
        change: modifiedChange,
        client,
        apiDefinitions: jsmApiDefinitions,
        additionalUrlVars,
      })
      if (isAdditionOrModificationChange(change)) {
        const data = _.omit(instance.value, ['objectType', 'typeValue'])
        const url = `gateway/api/jsm/assets/workspace/${workspaceId}/v1/objecttypeattribute/${instance.value.id}/configure`
        await client.put({
          url,
          data,
        })
      }
    }
  )
}

/* This filter deploys JSM attribute changes using two different endpoints. */
const filter: FilterCreator = ({ config, client }) => ({
  name: 'deployAttributesFilter',
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM
      || !config.fetch.enableJsmExperimental
      || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [attributesChanges, leftoverChanges] = _.partition(
      changes.filter(isInstanceChange),
      change => isInstanceChange(change)
      && getChangeData(change).elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE
    )

    const workspaceId = await getWorkspaceId(client)
    if (workspaceId === undefined) {
      log.error(`Skip deployment of ${OBJECT_TYPE_ATTRIBUTE_TYPE} types because workspaceId is undefined`)
      const errors = attributesChanges.map(change => createSaltoElementError({
        message: 'workspaceId could not be found.',
        severity: 'Error',
        elemID: getChangeData(change).elemID,
      }))
      return {
        deployResult: { appliedChanges: [], errors },
        leftoverChanges,
      }
    }
    const attributeAdditionChanges = changes.filter(isAdditionChange)
      .filter(change => isInstanceChange(change))
      .filter(change => getChangeData(change).elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE)

    const objectTypeToAttributeAdditions = _.groupBy(attributeAdditionChanges.filter(isInstanceChange),
      change => {
        const instance = getChangeData(change)
        if (!isReferenceExpression(instance.value.objectType)) {
          return ''
        }
        return instance.value.objectType.elemID.getFullName()
      })

    const objectTypeToEditableExistiningAttributes: Record<string, string[][]> = Object.fromEntries(
      await Promise.all(Object.entries(objectTypeToAttributeAdditions)
        .map(async ([objectTypeName, attributeChanges]) =>
          [
            objectTypeName,
            await getExsitingAttributesNamesAndIds(
              attributeChanges,
              client,
              workspaceId,
            )]))
    )
    const deployResult = await deployAttributeChanges({
      jsmApiDefinitions,
      changes: attributesChanges,
      client,
      workspaceId,
      objectTypeToEditableExistiningAttributes,
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
