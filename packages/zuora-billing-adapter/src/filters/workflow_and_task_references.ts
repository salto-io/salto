/*
*                      Copyright 2021 Salto Labs Ltd.
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
  Element, isObjectType, InstanceElement, ElemID, isInstanceElement, ReferenceExpression,
  isField, ObjectType,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { TASK_TYPE, WORKFLOW_TYPE } from '../constants'
import { FilterCreator } from '../filter'
import { isObjectDef } from '../element_utils'

const log = logger(module)
const { flatMapAsync, toAsyncIterable, awu } = collections.asynciterable

const addWorkflowDependencies = (
  inst: InstanceElement,
  typeLowercaseLookup: multiIndex.Index<[string], ElemID>,
  fieldLowercaseLookup: multiIndex.Index<[string, string], ElemID>,
): void => {
  const paramFields = inst.value.additionalProperties?.parameters?.fields
  if (!Array.isArray(paramFields) || !paramFields.every(_.isPlainObject)) {
    return
  }

  paramFields.forEach(fieldDef => {
    const objName = fieldDef.object_name?.toLowerCase()
    const objId = typeLowercaseLookup.get(objName)
    if (objId === undefined) {
      return
    }
    fieldDef.object_name = new ReferenceExpression(objId)
    const fieldId = fieldLowercaseLookup.get(objName, fieldDef.field_name)
    if (fieldId !== undefined) {
      fieldDef.field_name = new ReferenceExpression(fieldId)
    }
  })
}

const addTaskDependencies = (
  inst: InstanceElement,
  typeLowercaseLookup: multiIndex.Index<[string], ElemID>,
  fieldLowercaseLookup: multiIndex.Index<[string, string], ElemID>,
): void => {
  if (_.isString(inst.value.object)) {
    const objId = typeLowercaseLookup.get(inst.value.object.toLowerCase())
    if (objId !== undefined) {
      inst.value.object = new ReferenceExpression(objId)
    }
  }

  if (!_.isPlainObject(inst.value.parameters?.fields)) {
    return
  }

  // the type of the parameters is not specified in the swagger
  const deps = Object.entries(
    inst.value.parameters.fields
  ).flatMap(([typeName, fieldMapping]) => {
    if (!_.isPlainObject(fieldMapping)) {
      return []
    }
    return Object.keys(fieldMapping as object).flatMap(fieldName => {
      // not looking up custom objects for now - if we did, they'd need to have
      // CUSTOM_OBJECT_SUFFIX appended for lookup
      const fieldId = fieldLowercaseLookup.get(typeName.toLowerCase(), fieldName)
      if (fieldId !== undefined) {
        return [new ReferenceExpression(fieldId)]
      }
      return []
    })
  })

  if (deps.length > 0) {
    extendGeneratedDependencies(inst, deps.map(dep => ({ reference: dep })))
  }
}

/**
 * Add references to fields used as parameters in workflow tasks.
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const workflowType = elements.filter(isObjectType).find(e => e.elemID.name === WORKFLOW_TYPE)
    if (workflowType === undefined) {
      log.warn('Could not find %s object type', WORKFLOW_TYPE)
      return
    }
    const taskType = elements.filter(isObjectType).find(e => e.elemID.name === TASK_TYPE)
    if (taskType === undefined) {
      log.warn('Could not find %s object type', TASK_TYPE)
      return
    }

    const instances = elements.filter(isInstanceElement)
    const workflowInstances = instances.filter(inst => inst.elemID.typeName === WORKFLOW_TYPE)
    const taskInstances = instances.filter(inst => inst.elemID.typeName === TASK_TYPE)
    if (workflowInstances.length === 0 && taskInstances.length === 0) {
      return
    }

    // for now only supporting standard objects - not clear if and how custom objects can be
    // referenced from workflows

    const objectDefs = await awu(elements).filter(isObjectDef).toArray() as ObjectType[]
    const {
      typeLowercaseLookup, fieldLowercaseLookup,
    } = await multiIndex.buildMultiIndex<Element>()
      .addIndex({
        name: 'typeLowercaseLookup',
        filter: isObjectDef,
        // id name changes are currently not allowed so it's ok to use the elem id
        key: type => [type.elemID.name.toLowerCase()],
        map: type => type.elemID,
      })
      .addIndex({
        name: 'fieldLowercaseLookup',
        filter: isField,
        // id name changes are currently not allowed so it's ok to use the elem id
        key: field => [field.elemID.typeName.toLowerCase(), field.elemID.name],
        map: field => field.elemID,
      })
      .process(
        flatMapAsync(toAsyncIterable(objectDefs), obj => [obj, ...Object.values(obj.fields)])
      )

    workflowInstances.forEach(
      workflow => addWorkflowDependencies(workflow, typeLowercaseLookup, fieldLowercaseLookup)
    )
    taskInstances.forEach(
      task => addTaskDependencies(task, typeLowercaseLookup, fieldLowercaseLookup)
    )
  },
})

export default filterCreator
