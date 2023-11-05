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

import { ObjectType, Values, ElemIdGetter, InstanceElement, isInstanceElement, ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { ASSESET_SCHEMA_TYPE, JIRA } from '../../constants'

const log = logger(module)

const createAssestsObjectTypeType = (): ObjectType => {
  const assestSchemaType = new ObjectType({
    elemID: new ElemID(JIRA, 'AssestsObjectType'),
    fields: {
      workspaceId: { refType: BuiltinTypes.STRING },
      globalId: { refType: BuiltinTypes.STRING },
      id: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
      description: { refType: BuiltinTypes.STRING },
      type: { refType: BuiltinTypes.NUMBER },
      position: { refType: BuiltinTypes.NUMBER },
      created: { refType: BuiltinTypes.STRING },
      updated: { refType: BuiltinTypes.STRING },
    },
  })
  return assestSchemaType
}

const getAssestsObjectTypes = async (
  client: JiraClient,
  assestsSchema: InstanceElement,
): Promise<Values[]> => {
  const response = (await (client.getSinglePage({
    url: `/gateway/api/jsm/assets/workspace/${assestsSchema.value.workspceId}/v1/objectschema/${assestsSchema.value.id}/objecttypes/flat`,
  }))).data as Values[]
  return response
}

const createInstance = (
  type: ObjectType,
  values: Values,
  assestsSchema: InstanceElement,
  getElemIdFunc?: ElemIdGetter
):
InstanceElement => {
  const serviceIds = elementUtils.createServiceIds(values, 'id', type.elemID)
  const defaultName = naclCase(`${assestsSchema.value.name}_${values.name}`)
  const instanceName = getElemIdFunc && serviceIds
    ? getElemIdFunc(JIRA, serviceIds, defaultName).name
    : defaultName
  const parentPath = assestsSchema.path ?? []
  return new InstanceElement(
    instanceName,
    type,
    values,
    [...parentPath.slice(0, -1), 'assestsObjectTypes', pathNaclCase(instanceName)]
  )
}

/**
 * Fetching assests from Jira using internal API endpoint.
 */
const filter: FilterCreator = ({ client, config, getElemIdFunc }) => ({
  name: 'AssestsObjectTypeFetchFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental) {
      return undefined
    }
    try {
      const assestsObjecTypeType = createAssestsObjectTypeType()
      const assestSchemas = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === ASSESET_SCHEMA_TYPE)
      await Promise.all(assestSchemas.map(async assestSchema => {
        const assestsObjectTypes = await getAssestsObjectTypes(client, assestSchema)
        assestsObjectTypes.forEach(assestsObjectType => elements.push(
          createInstance(assestsObjecTypeType, assestsObjectType, assestSchema, getElemIdFunc)
        ))
      }))
      elements.push(assestsObjecTypeType)
      return undefined
    } catch (err) {
      log.error(`Received a ${err.response.status} error when fetching assests object Types.`)
      return {
        errors: [
          {
            message: `Received a ${err.response.status} error when fetching assests object Types.`,
            severity: 'Warning',
          },
        ],
      }
    }
  },
})

export default filter
