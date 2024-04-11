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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Change,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  ObjectType,
  Values,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { resolveValues, restoreChangeElement } from '@salto-io/adapter-components'

import { FilterCreator } from '../../filter'
import { DASHBOARD_GADGET_TYPE, JIRA } from '../../constants'
import { findObject } from '../../utils'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable

const convertMapToList = (map: Record<string, unknown>): Values[] =>
  Object.entries(map)
    .filter(([_key, value]) => value != null && (!_.isObject(value) || !_.isEmpty(value)))
    // The reason to separate `value` and `values` is because when the value is an object,
    // we want to create references to values inside it, so we it must have a field with a type.
    // If we put the value in the same field whether it is a plainObject or not,
    // there wouldn't be an appropriate type we could use.
    .map(([key, value]) =>
      _.isPlainObject(value) ? { key, values: convertMapToList(value as Record<string, unknown>) } : { key, value },
    )

const convertListToMap = (list: Values[]): Record<string, unknown> =>
  Object.fromEntries(
    list.map(({ key, value, values }) => [key, value ?? (Array.isArray(values) ? convertListToMap(values) : values)]),
  )

const convertPropertiesToLists = (instance: InstanceElement): void => {
  if (!_.isPlainObject(instance.value.properties)) {
    return
  }
  instance.value.properties = convertMapToList(instance.value.properties)
}

/**
 * This filter converts the properties in gadgets from maps to lists.
 * This is because the keys of the maps might cause syntax errors in the NaCl.
 */
const filter: FilterCreator = () => {
  const originalChanges: Record<string, Change<InstanceElement>> = {}
  return {
    name: 'gadgetPropertiesFilter',
    onFetch: async elements => {
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === DASHBOARD_GADGET_TYPE)
        .forEach(convertPropertiesToLists)

      const gadgetPropertyType = new ObjectType({
        elemID: new ElemID(JIRA, 'DashboardGadgetProperty'),
        fields: {
          key: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
          },
          value: {
            refType: BuiltinTypes.UNKNOWN,
            annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
          },
        },
      })
      gadgetPropertyType.fields.values = new Field(gadgetPropertyType, 'values', new ListType(gadgetPropertyType), {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      const gadgetType = findObject(elements, DASHBOARD_GADGET_TYPE)
      if (gadgetType === undefined) {
        return
      }

      gadgetType.fields.properties = new Field(gadgetType, 'properties', new ListType(gadgetPropertyType), {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
      elements.push(gadgetPropertyType)
    },

    preDeploy: async changes => {
      const relevantChanges = changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === DASHBOARD_GADGET_TYPE)

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          originalChanges[getChangeData(change).elemID.getFullName()] = change
          return applyFunctionToChangeData<Change<InstanceElement>>(change, async instance => {
            // We need to resolve references before we change instance structure
            const resolvedInstance = await resolveValues(instance, getLookUpName)
            if (Array.isArray(resolvedInstance.value.properties)) {
              resolvedInstance.value.properties = convertListToMap(resolvedInstance.value.properties)
            }
            return resolvedInstance
          })
        })
        .toArray()

      _.pullAll(changes, relevantChanges)
      changesToReturn.forEach(change => changes.push(change))
    },

    onDeploy: async changes => {
      const relevantChanges = changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === DASHBOARD_GADGET_TYPE)

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
            convertPropertiesToLists(instance)
            return instance
          })
          return restoreChangeElement(change, originalChanges, getLookUpName)
        })
        .toArray()

      _.pullAll(changes, relevantChanges)
      changesToReturn.forEach(change => changes.push(change))
    },
  }
}

export default filter
