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

import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { DAG } from '@salto-io/dag'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'

const { awu } = collections.asynciterable

const createPaths = async (assetsObjectTypes: InstanceElement[]): Promise<void> => {
  const graph = new DAG<InstanceElement>()
  assetsObjectTypes.forEach(assetsObjectType => {
    const parentFullName = assetsObjectType.value.parentObjectTypeId?.value.elemID.name
    const dependencies = parentFullName ? [parentFullName] : []
    graph.addNode(
      assetsObjectType.elemID.name,
      dependencies,
      assetsObjectType,
    )
  })
  await awu(graph.evaluationOrder()).forEach(
    graphNode => {
      const instance = graph.getData(graphNode.toString())
      const parentPath = instance.value.parentObjectTypeId?.value.path
      if (parentPath === undefined) {
        instance.path = [...instance.path ?? [], pathNaclCase(instance.elemID.name)]
        return
      }
      instance.path = [...parentPath.slice(0, -1), 'childObjectTypes', instance.elemID.name, instance.elemID.name]
    }
  )
}


const filter: FilterCreator = ({ config }) => ({
  name: 'assetsObjectTypePath',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    const assetsObjectTypes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === 'AssetsObjectType')
    await createPaths(assetsObjectTypes)
  },
})
export default filter
