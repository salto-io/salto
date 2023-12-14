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
import { BuiltinTypes, CORE_ANNOTATIONS, Element, ElemID, InstanceElement, isInstanceElement, isReferenceExpression, ListType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { ASSETS_OBJECT_TYPE, ASSETS_OBJECT_TYPE_ORDER_TYPE, JIRA } from '../../constants'

const createOrderType = (): ObjectType => new ObjectType({
  elemID: new ElemID(JIRA, ASSETS_OBJECT_TYPE_ORDER_TYPE),
  fields: {
    objectTypes: {
      refType: new ListType(BuiltinTypes.NUMBER),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
    },
    assetsSchema: {
      refType: BuiltinTypes.NUMBER,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
    },
  },
  path: [JIRA, adapterElements.TYPES_PATH, ASSETS_OBJECT_TYPE_ORDER_TYPE],
  annotations: {
    [CORE_ANNOTATIONS.CREATABLE]: true,
    [CORE_ANNOTATIONS.UPDATABLE]: true,
    [CORE_ANNOTATIONS.DELETABLE]: true,
  },
})

const createAssetsObjectTypeOrder = (assetsObjectTypes: InstanceElement[], orderType: ObjectType): InstanceElement => {
  const treeParent = assetsObjectTypes[0].value.parentObjectTypeId.value
  const schema = assetsObjectTypes[0].annotations[CORE_ANNOTATIONS.PARENT]?.[0]
  const name = `${treeParent.elemID.name}_order`
  return new InstanceElement(
    name,
    orderType,
    {
      objectTypes: assetsObjectTypes.sort((a, b) => a.value.position - b.value.position)
        .map(inst => new ReferenceExpression(inst.elemID, inst)),
      assetsSchema: schema,
    },
    [...treeParent.path.slice(0, -1), 'childOrder', pathNaclCase(name)],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(treeParent.elemID, treeParent)],
    }
  )
}

/* Handles the assetsObjectTypes order inside each assets objectType
 by creating an InstanceElement of the assetsObjectTypes order inside the assets objectType. */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'fetchAssetsObjectTypeOrderFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental) {
      return
    }

    const assetsObjectTypeInstances = elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === ASSETS_OBJECT_TYPE)

    const parentToObjectTypes = _.groupBy(
      assetsObjectTypeInstances.filter(objectType => isReferenceExpression(objectType.value.parentObjectTypeId)),
      objectType => objectType.value.parentObjectTypeId.elemID.getFullName()
    )
    const orderType = createOrderType()
    elements.push(orderType)
    Object.values(parentToObjectTypes).forEach(assetsObjectTypes => {
      const orderInstance = createAssetsObjectTypeOrder(assetsObjectTypes, orderType)
      elements.push(orderInstance)
    })
    // Remove position field from the assetsObjectTypes
    assetsObjectTypeInstances.forEach(assetsObjectTypeInstance => {
      delete assetsObjectTypeInstance.value.position
    })
  },
})

export default filterCreator
