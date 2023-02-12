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
import {
  Element, isObjectType, InstanceElement, ElemID, isInstanceElement, ReferenceExpression,
  isField, CORE_ANNOTATIONS, isReferenceExpression,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies, FlatDetailedDependency, resolvePath, walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, multiIndex, values, strings } from '@salto-io/lowerdash'
import { TASK_TYPE, WORKFLOW_EXPORT_TYPE, WORKFLOW_DETAILED_TYPE } from '../constants'
import { FilterCreator } from '../filter'
import { getObjectDefs, getTypeNameAsReferenced, isObjectDef } from '../element_utils'

const { matchAll } = strings
const { isDefined } = values

const log = logger(module)
const { flatMapAsync, toAsyncIterable } = collections.asynciterable

const WORKFLOW_PARAMS_REF = 'Workflow'
const WORKFLOW_PARAMS_PATH = ['additionalProperties', 'parameters', 'fields']
const TASK_PARAM_FIELDS_PATH = ['parameters', 'fields']
const TASK_REFS_REGEX = /(\w+\.)*(?<typeName>\w+)\.(?<fieldName>\w+)/g

type StringReference = {
  typeName: string
  fieldName: string
}

const addWorkflowDependencies = (
  inst: InstanceElement,
  typeLowercaseLookup: multiIndex.Index<[string], ElemID>,
  fieldLowercaseLookup: multiIndex.Index<[string, string], ElemID>,
): void => {
  const paramFields = resolvePath(inst, inst.elemID.createNestedID(...WORKFLOW_PARAMS_PATH))
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
    const fieldId = fieldLowercaseLookup.get(objName, fieldDef.field_name?.toLowerCase())
    if (fieldId !== undefined) {
      fieldDef.field_name = new ReferenceExpression(fieldId)
    }
  })
}

const addParameterFieldsFieldDependency = (
  inst: InstanceElement,
  fieldLowercaseLookup: multiIndex.Index<[string, string], ElemID>,
): FlatDetailedDependency[] => {
  const parametersFieldsElemId = inst.elemID.createNestedID(...TASK_PARAM_FIELDS_PATH)
  const parameterFields = resolvePath(inst, parametersFieldsElemId)
  if (!_.isPlainObject(parameterFields)) {
    return []
  }

  // the type of the parameters is not specified in the swagger
  return Object.entries(parameterFields).flatMap(([typeName, fieldMapping]) => {
    if (!_.isPlainObject(fieldMapping)) {
      return []
    }
    return Object.keys(fieldMapping as object).flatMap(fieldName => {
      // not looking up custom objects for now - if we did, they'd need to have
      // CUSTOM_OBJECT_SUFFIX appended for lookup
      const fieldId = fieldLowercaseLookup.get(typeName.toLowerCase(), fieldName.toLowerCase())
      if (fieldId !== undefined) {
        return [{
          reference: new ReferenceExpression(fieldId),
          location: new ReferenceExpression(
            parametersFieldsElemId.createNestedID(typeName, fieldName)
          ),
        }]
      }
      return []
    })
  })
}

const addStringsReferencesDependency = (
  inst: InstanceElement,
  fieldLowercaseLookup: multiIndex.Index<[string, string], ElemID>,
  parentWorkflow?: InstanceElement
): FlatDetailedDependency[] => {
  const dependencies: FlatDetailedDependency[] = []
  const func: WalkOnFunc = ({ value, path }) => {
    if (!_.isString(value)) {
      return WALK_NEXT_STEP.RECURSE
    }

    const potentialReferences = _.uniq([...matchAll(value, TASK_REFS_REGEX)]
      .map(r => r.groups)
      .filter(isDefined)) as StringReference[]
    if (_.isEmpty(potentialReferences)) {
      return WALK_NEXT_STEP.SKIP
    }

    const references = potentialReferences.map(({ typeName, fieldName }) => {
      const fieldId = fieldLowercaseLookup.get(typeName.toLowerCase(), fieldName.toLowerCase())
      if (isDefined(fieldId)) {
        return new ReferenceExpression(fieldId)
      }

      if (typeName !== WORKFLOW_PARAMS_REF || !isDefined(parentWorkflow)) {
        return undefined
      }

      const workflowParams = resolvePath(
        parentWorkflow, parentWorkflow.elemID.createNestedID(...WORKFLOW_PARAMS_PATH)
      )
      if (!_.isArray(workflowParams)) {
        return undefined
      }

      if (workflowParams.some(field =>
        field.object_name === WORKFLOW_PARAMS_REF && field.field_name === fieldName)) {
        return new ReferenceExpression(
          parentWorkflow.elemID.createNestedID(...WORKFLOW_PARAMS_PATH)
        )
      }
      return undefined
    }).filter(isDefined)

    references.forEach(
      reference => dependencies.push({ reference, location: new ReferenceExpression(path) })
    )

    return WALK_NEXT_STEP.SKIP
  }

  walkOnElement({ element: inst, func })
  return dependencies
}

const addTaskDependencies = (
  inst: InstanceElement,
  fieldLowercaseLookup: multiIndex.Index<[string, string], ElemID>,
  topWorkflows: InstanceElement[],
  workflows: InstanceElement[]
): void => {
  const topWorkflowReference = _.isArray(inst.annotations[CORE_ANNOTATIONS.PARENT])
    && inst.annotations[CORE_ANNOTATIONS.PARENT].find(isReferenceExpression)
  const parentTopWorkflow = isReferenceExpression(topWorkflowReference)
    && topWorkflows.find(workflow => workflow.elemID.isEqual(topWorkflowReference.elemID))
  const parentWorkflow = isInstanceElement(parentTopWorkflow)
    ? workflows.find(workflow => workflow.elemID.isEqual(parentTopWorkflow.value.workflow.elemID))
    : undefined

  const deps = _.concat(
    addParameterFieldsFieldDependency(inst, fieldLowercaseLookup),
    addStringsReferencesDependency(inst, fieldLowercaseLookup, parentWorkflow)
  )
  if (deps.length > 0) {
    extendGeneratedDependencies(inst, deps)
  }
}

/**
 * Add references to fields used as parameters in workflow tasks.
 */
const filterCreator: FilterCreator = () => ({
  name: 'workflowAndTaskReferencesFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const workflowTopType = elements.filter(isObjectType)
      .find(e => e.elemID.name === WORKFLOW_EXPORT_TYPE)
    if (workflowTopType === undefined) {
      log.warn('Could not find %s object type', WORKFLOW_EXPORT_TYPE)
      return
    }
    const workflowType = elements.filter(isObjectType)
      .find(e => e.elemID.name === WORKFLOW_DETAILED_TYPE)
    if (workflowType === undefined) {
      log.warn('Could not find %s object type', WORKFLOW_DETAILED_TYPE)
      return
    }
    const taskType = elements.filter(isObjectType).find(e => e.elemID.name === TASK_TYPE)
    if (taskType === undefined) {
      log.warn('Could not find %s object type', TASK_TYPE)
      return
    }

    const instances = elements.filter(isInstanceElement)
    const topWorkflowInstances = instances.filter(inst =>
      inst.elemID.typeName === WORKFLOW_EXPORT_TYPE)
    const workflowInstances = instances
      .filter(inst => inst.elemID.typeName === WORKFLOW_DETAILED_TYPE)
    const taskInstances = instances.filter(inst => inst.elemID.typeName === TASK_TYPE)
    if (workflowInstances.length === 0 && taskInstances.length === 0) {
      return
    }

    const objectDefs = await getObjectDefs(elements)
    const {
      typeLowercaseLookup, fieldLowercaseLookup,
    } = await multiIndex.buildMultiIndex<Element>()
      .addIndex({
        name: 'typeLowercaseLookup',
        filter: isObjectDef,
        key: async type => [await getTypeNameAsReferenced(type)],
        map: type => type.elemID,
      })
      .addIndex({
        name: 'fieldLowercaseLookup',
        filter: isField,
        key: async field => [
          await getTypeNameAsReferenced(field.parent), field.elemID.name.toLowerCase(),
        ],
        map: field => field.elemID,
      })
      .process(
        flatMapAsync(toAsyncIterable(objectDefs), obj => [obj, ...Object.values(obj.fields)])
      )

    workflowInstances.forEach(
      workflow => addWorkflowDependencies(workflow, typeLowercaseLookup, fieldLowercaseLookup)
    )
    taskInstances.forEach(
      task => addTaskDependencies(
        task,
        fieldLowercaseLookup,
        topWorkflowInstances,
        workflowInstances
      )
    )
  },
})

export default filterCreator
