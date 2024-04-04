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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
  ListType,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { getParent, invertNaclCase, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { deployChanges } from '../../deployment/standard_deployment'
import { getWorkspaceId, getWorkspaceIdMissingErrors } from '../../workspace_id'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE, OBJECT_TYPE_ORDER_TYPE, JIRA } from '../../constants'
import { FilterCreator } from '../../filter'
import JiraClient from '../../client/client'
import { setTypeDeploymentAnnotations } from '../../utils'

const { awu } = collections.asynciterable
const log = logger(module)

const deployOrderChange = async ({
  client,
  workspaceId,
  position,
  toObjectTypeId,
  assetsObjectType,
}: {
  client: JiraClient
  workspaceId: string
  position: number
  toObjectTypeId?: string
  assetsObjectType: ReferenceExpression
}): Promise<void> => {
  const { id } = assetsObjectType.value.value
  const data = toObjectTypeId === undefined ? { position } : { position, toObjectTypeId }
  const url = `/gateway/api/jsm/assets/workspace/${workspaceId}/v1/objecttype/${id}/position`
  await client.post({ url, data })
}

const createOrderType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, OBJECT_TYPE_ORDER_TYPE),
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
    path: [JIRA, adapterElements.TYPES_PATH, OBJECT_TYPE_ORDER_TYPE],
    annotations: {
      [CORE_ANNOTATIONS.CREATABLE]: true,
      [CORE_ANNOTATIONS.UPDATABLE]: true,
      [CORE_ANNOTATIONS.DELETABLE]: true,
    },
  })

const createAssetsObjectTypeOrder = (
  assetsObjectTypes: InstanceElement[],
  orderType: ObjectType,
  treeParent: InstanceElement,
): InstanceElement | undefined => {
  const schema =
    treeParent.elemID?.typeName === OBJECT_TYPE_TYPE
      ? treeParent.annotations[CORE_ANNOTATIONS.PARENT]?.[0]
      : new ReferenceExpression(treeParent.elemID, treeParent)
  if (schema.elemID?.typeName !== OBJECT_SCHEMA_TYPE) {
    log.error(
      `Failed to create ${OBJECT_TYPE_ORDER_TYPE} for ${treeParent.elemID.getFullName()} because it's parent is not ${OBJECT_SCHEMA_TYPE}`,
    )
    return undefined
  }
  const name = naclCase(`${invertNaclCase(treeParent.elemID.name)}_childOrder`)
  const subFolder = treeParent.elemID.typeName === OBJECT_TYPE_TYPE ? [] : ['objectTypes']
  return new InstanceElement(
    name,
    orderType,
    {
      objectTypes: assetsObjectTypes
        .sort((a, b) => a.value.position - b.value.position)
        .map(inst => new ReferenceExpression(inst.elemID, inst)),
      assetsSchema: schema,
    },
    [...(treeParent.path ?? []).slice(0, -1), ...subFolder, pathNaclCase(name)],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(treeParent.elemID, treeParent)],
    },
  )
}

/* Handles the assetsObjectTypes order inside each assets objectType
 * by creating an InstanceElement of the assetsObjectTypes order inside the assets objectType.
 */
const filterCreator: FilterCreator = ({ config, client, fetchQuery }) => ({
  name: 'assetsObjectTypeOrderFilter',
  onFetch: async (elements: Element[]) => {
    if (
      !config.fetch.enableJSM ||
      !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium) ||
      !fetchQuery.isTypeMatch(OBJECT_TYPE_TYPE)
    ) {
      return
    }

    const assetsObjectTypeInstances = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === OBJECT_TYPE_TYPE)

    const parentToObjectTypes = _.groupBy(
      assetsObjectTypeInstances.filter(objectType => isReferenceExpression(objectType.value.parentObjectTypeId)),
      objectType => objectType.value.parentObjectTypeId.elemID.getFullName(),
    )

    const instanceNameToInstacne = _.keyBy(
      elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === OBJECT_TYPE_TYPE || e.elemID.typeName === OBJECT_SCHEMA_TYPE),
      inst => inst.elemID.getFullName(),
    )

    const orderType = createOrderType()
    setTypeDeploymentAnnotations(orderType)
    elements.push(orderType)
    Object.entries(parentToObjectTypes).forEach(([treeParentName, assetsObjectTypes]) => {
      const orderInstance = createAssetsObjectTypeOrder(
        assetsObjectTypes,
        orderType,
        instanceNameToInstacne[treeParentName],
      )
      if (orderInstance === undefined) {
        return
      }
      elements.push(orderInstance)
    })
    // Remove position field from the assetsObjectTypes
    assetsObjectTypeInstances.forEach(assetsObjectTypeInstance => {
      delete assetsObjectTypeInstance.value.position
    })
  },
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (
      !config.fetch.enableJSM ||
      !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium) ||
      jsmApiDefinitions === undefined
    ) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === OBJECT_TYPE_ORDER_TYPE,
    )
    const workspaceId = await getWorkspaceId(client, config)
    if (workspaceId === undefined) {
      log.error(`Skip deployment of ${OBJECT_TYPE_ORDER_TYPE} types because workspaceId is undefined`)
      const errors = getWorkspaceIdMissingErrors(relevantChanges)
      return {
        deployResult: { appliedChanges: [], errors },
        leftoverChanges,
      }
    }
    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const instance = getChangeData(change)
      const parent = getParent(instance)
      const toObjectTypeId = parent.elemID.typeName === OBJECT_TYPE_TYPE ? parent.value.id : undefined
      if (isAdditionChange(change)) {
        await awu(instance.value.objectTypes)
          .filter(isReferenceExpression)
          .forEach(async (assetsObjectType, position) => {
            await deployOrderChange({
              client,
              workspaceId,
              position,
              toObjectTypeId,
              assetsObjectType,
            })
          })
      }
      if (isModificationChange(change)) {
        const positionsBefore = change.data.before.value.objectTypes
          .filter(isReferenceExpression)
          .filter((ref: ReferenceExpression) => ref.elemID.typeName === OBJECT_TYPE_TYPE)
        await awu(instance.value.objectTypes)
          .filter(isReferenceExpression)
          .filter(ref => ref.elemID.typeName === OBJECT_TYPE_TYPE)
          .forEach(async (assetsObjectType, position) => {
            if (positionsBefore[position]?.elemID.getFullName() !== assetsObjectType.elemID.getFullName()) {
              await deployOrderChange({
                client,
                workspaceId,
                position,
                toObjectTypeId,
                assetsObjectType,
              })
            }
          })
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
