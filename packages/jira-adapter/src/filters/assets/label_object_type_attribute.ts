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
  createSaltoElementError,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isRemovalChange,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { invertNaclCase, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { deployChanges } from '../../deployment/standard_deployment'
import { OBJECT_TYPE_TYPE, JIRA, OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { getWorkspaceId } from '../../workspace_id'

const log = logger(module)

const createLabelAttributeType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE),
    fields: {
      labelAttribute: {
        refType: BuiltinTypes.NUMBER,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
      },
      objectType: {
        refType: BuiltinTypes.NUMBER,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
    },
    path: [JIRA, adapterElements.TYPES_PATH, OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE],
    annotations: {
      [CORE_ANNOTATIONS.CREATABLE]: true,
      [CORE_ANNOTATIONS.UPDATABLE]: true,
      [CORE_ANNOTATIONS.DELETABLE]: true,
    },
  })

const createLabelAttributeInstance = (
  attributes: InstanceElement[],
  labelAttributeType: ObjectType,
  objectType: InstanceElement,
): InstanceElement | undefined => {
  const name = naclCase(`${invertNaclCase(objectType.elemID.name)}_label_attribute`)
  const labelAttribute = attributes.find(attribute => attribute.value.label === true)
  if (labelAttribute === undefined) {
    return undefined
  }
  return new InstanceElement(
    name,
    labelAttributeType,
    {
      labelAttribute: new ReferenceExpression(labelAttribute.elemID, labelAttribute),
      objectType: new ReferenceExpression(objectType.elemID, objectType),
    },
    [...(objectType.path ?? []).slice(0, -1), 'attributes', pathNaclCase(name)],
  )
}

/* Handles the object type Label attribute inside each objectType
 * by creating an InstanceElement of the Label attribute.
 */
const filterCreator: FilterCreator = ({ config, fetchQuery, client }) => ({
  name: 'dafaultAttributeFilter',
  onFetch: async (elements: Element[]) => {
    if (
      !config.fetch.enableJSM ||
      !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium) ||
      !fetchQuery.isTypeMatch(OBJECT_TYPE_ATTRIBUTE_TYPE)
    ) {
      return
    }

    const objectTypeAttributeInstances = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE)

    const parentToObjectTypeAttributes = _.groupBy(
      objectTypeAttributeInstances.filter(attribute => isReferenceExpression(attribute.value.objectType)),
      attribute => attribute.value.objectType.elemID.getFullName(),
    )

    const instanceNameToInstacne = _.keyBy(
      elements.filter(isInstanceElement).filter(e => e.elemID.typeName === OBJECT_TYPE_TYPE),
      inst => inst.elemID.getFullName(),
    )

    const labelAttributeType = createLabelAttributeType()
    elements.push(labelAttributeType)
    Object.entries(parentToObjectTypeAttributes).forEach(([parentName, attributes]) => {
      const labelAttributeInstance = createLabelAttributeInstance(
        attributes,
        labelAttributeType,
        instanceNameToInstacne[parentName],
      )
      if (labelAttributeInstance === undefined) {
        return
      }
      elements.push(labelAttributeInstance)
    })
    // Remove label value from attributes
    objectTypeAttributeInstances.forEach(attribute => {
      delete attribute.value.label
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
      change => getChangeData(change).elemID.typeName === OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE,
    )
    const workspaceId = await getWorkspaceId(client, config)
    if (workspaceId === undefined) {
      log.error(`Skipped deployment of ${OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE} type because its workspaceId is undefined`)
      const errors = relevantChanges.map(change =>
        createSaltoElementError({
          message: `The following changes were not deployed, due to error with the workspaceId: ${relevantChanges.map(c => getChangeData(c).elemID.getFullName()).join(', ')}`,
          severity: 'Error',
          elemID: getChangeData(change).elemID,
        }),
      )
      return {
        deployResult: { appliedChanges: [], errors },
        leftoverChanges,
      }
    }
    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      // We cover this case in a CV. Meaning that if we got here than the label attribute will be deleted
      // With it's parent object type.
      if (isRemovalChange(change)) {
        return
      }
      const instance = getChangeData(change)
      const attribute = isReferenceExpression(instance.value.labelAttribute)
        ? instance.value.labelAttribute.value
        : undefined
      if (attribute === undefined) {
        return
      }
      await client.put({
        url: `/gateway/api/jsm/assets/workspace/${workspaceId}/v1/objecttypeattribute/${attribute.value.id}/configure`,
        data: {
          label: true,
        },
      })
    })

    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
