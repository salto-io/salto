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

import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { DAG } from '@salto-io/dag'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE } from '../../constants'

const { awu } = collections.asynciterable

const createPaths = async (objectTypes: InstanceElement[]): Promise<void> => {
  const graph = new DAG<InstanceElement>()
  objectTypes.forEach(objectType => {
    const parentFullName =
      objectType.value.parentObjectTypeId?.elemID.typeName === OBJECT_SCHEMA_TYPE
        ? undefined
        : objectType.value.parentObjectTypeId.elemID.name
    const dependencies = parentFullName ? [parentFullName] : []
    graph.addNode(objectType.elemID.name, dependencies, objectType)
  })
  await awu(graph.evaluationOrder()).forEach(graphNode => {
    const instance = graph.getData(graphNode.toString())
    const parentPath = instance.value.parentObjectTypeId.value.path
    instance.path =
      instance.value.parentObjectTypeId.elemID.typeName === OBJECT_SCHEMA_TYPE
        ? [
            ...parentPath.slice(0, -1),
            'objectTypes',
            pathNaclCase(instance.value.name),
            pathNaclCase(instance.elemID.name),
          ]
        : [...parentPath.slice(0, -1), pathNaclCase(instance.value.name), pathNaclCase(instance.elemID.name)]
  })
}

/* This filter aligns the path of assets object types with the Jira UI. */
const filter: FilterCreator = ({ config }) => ({
  name: 'assetsObjectTypePath',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium)) {
      return
    }
    const objectTypes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === OBJECT_TYPE_TYPE)
    await createPaths(objectTypes)
  },
})
export default filter
