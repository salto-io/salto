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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ListType, ObjectType, Values, getChangeData, isAdditionOrModificationChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { DASHBOARD_GADGET_TYPE, JIRA } from '../../constants'
import { findObject } from '../../utils'

const convertMapToList = (map: Record<string, unknown>): Values[] => Object.entries(map)
  .filter(([_key, value]) => value != null
    && (!_.isObject(value) || !_.isEmpty(value)))
  // The reason to separate `value` and `values` is because when the value is an object,
  // we want to create references to values inside it, so we it must have a field with a type.
  // If we put the value in the same field whether it is a plainObject or not,
  // there wouldn't be an appropriate type we could use.
  .map(([key, value]) => (_.isPlainObject(value) ? { key, values: value } : { key, value }))

const convertListToMap = (list: Values[]): Record<string, unknown> => Object.fromEntries(list
  .map(({ key, value, values }) => [key, value ?? values]))

const convertPropertiesToLists = (instance: InstanceElement): void => {
  if (!_.isPlainObject(instance.value.properties)) {
    return
  }
  // The depth of the properties is limited to two, otherwise the Jira API throws an error.
  instance.value.properties = convertMapToList(instance.value.properties)
  instance.value.properties
    .filter((property: Values) => _.isPlainObject(property.values))
    .forEach((property: Values) => {
      property.values = convertMapToList(property.values)
    })
}

/**
 * This filter converts the properties in gadgets from maps to lists.
 * This is because the keys of the maps might cause syntax errors in the NaCl.
 */
const filter: FilterCreator = () => ({
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
    gadgetPropertyType.fields.values = new Field(
      gadgetPropertyType,
      'values',
      new ListType(gadgetPropertyType),
      { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
    )

    const gadgetType = findObject(elements, DASHBOARD_GADGET_TYPE)
    if (gadgetType === undefined) {
      return
    }

    gadgetType.fields.properties = new Field(
      gadgetType,
      'properties',
      new ListType(gadgetPropertyType),
      { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
    )
    elements.push(gadgetPropertyType)
  },

  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => change.data.after.elemID.typeName === DASHBOARD_GADGET_TYPE)
      .filter(change => Array.isArray(change.data.after.value.properties))
      .forEach(change => {
        change.data.after.value.properties
          .filter((property: Values) => Array.isArray(property.values))
          .forEach((property: Values) => {
            property.values = convertListToMap(property.values)
          })
        change.data.after.value.properties = convertListToMap(change.data.after.value.properties)
      })
  },

  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => change.data.after.elemID.typeName === DASHBOARD_GADGET_TYPE)
      .map(getChangeData)
      .forEach(convertPropertiesToLists)
  },
})

export default filter
