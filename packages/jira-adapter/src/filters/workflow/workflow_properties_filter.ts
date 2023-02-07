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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, Element, ElemID, Field, getChangeData, InstanceElement, isInstanceElement, ListType, ObjectType, Values } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, resolveValues, restoreChangeElement } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { getWorkflowChanges, isWorkflowInstance, WorkflowInstance } from './types'
import { JIRA, WORKFLOW_STATUS_TYPE_NAME, WORKFLOW_TRANSITION_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'

const PROPERTY_TYPE_NAME = 'WorkflowProperty'

const { awu } = collections.asynciterable

const convertPropertiesToList = (instance: WorkflowInstance): void => {
  [
    ...(instance.value.statuses ?? []),
    ...(instance.value.transitions ?? []),
  ].forEach(item => {
    if (item.properties !== undefined) {
      item.properties = Object.entries(item.properties)
        .map(([key, value]) => ({ key, value }))
    }
  })
}

const convertPropertiesToMap = (instance: WorkflowInstance): void => {
  [
    ...(instance.value.statuses ?? []),
    ...(instance.value.transitions ?? []),
  ].forEach(item => {
    if (item.properties !== undefined) {
      item.properties = Object.fromEntries(
        item.properties.map(({ key, value }: Values) => [key, value])
      )
    }
  })
}

const filter: FilterCreator = () => {
  const originalChanges: Record<string, Change<InstanceElement>> = {}

  return {
    name: 'workflowPropertiesFilter',
    onFetch: async (elements: Element[]) => {
      const propertyType = new ObjectType({
        elemID: new ElemID(JIRA, PROPERTY_TYPE_NAME),
        fields: {
          key: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
          },
          value: {
            refType: BuiltinTypes.UNKNOWN,
            annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
          },
        },
        path: [JIRA, elementUtils.TYPES_PATH, PROPERTY_TYPE_NAME],
      })

      elements.push(propertyType)

      const workflowStatusType = findObject(elements, WORKFLOW_STATUS_TYPE_NAME)
      if (workflowStatusType !== undefined) {
        workflowStatusType.fields.properties = new Field(workflowStatusType, 'properties', new ListType(propertyType))
      }

      const workflowTransitionType = findObject(elements, WORKFLOW_TRANSITION_TYPE_NAME)
      if (workflowTransitionType !== undefined) {
        workflowTransitionType.fields.properties = new Field(workflowTransitionType, 'properties', new ListType(propertyType))
      }

      elements
        .filter(isInstanceElement)
        .filter(isWorkflowInstance)
        .forEach(convertPropertiesToList)
    },

    preDeploy: async changes => {
      const relevantChanges = getWorkflowChanges(changes)

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          originalChanges[getChangeData(change).elemID.getFullName()] = change
          return applyFunctionToChangeData<Change<WorkflowInstance>>(
            change,
            async instance => {
              // I have to call resolveValues here because after I change the status
              // properties structure the getLookUpName won't know how to resolve
              // the references inside correctly
              const resolvedInstance = (await resolveValues(instance, getLookUpName))
              convertPropertiesToMap(resolvedInstance)
              return resolvedInstance
            }
          )
        })
        .toArray()

      _.pullAll(changes, relevantChanges)
      changesToReturn.forEach(change => changes.push(change))
    },

    onDeploy: async changes => {
      const relevantChanges = getWorkflowChanges(changes)

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          await applyFunctionToChangeData<Change<WorkflowInstance>>(
            change,
            instance => {
              convertPropertiesToList(instance)
              return instance
            }
          )
          return restoreChangeElement(change, originalChanges, getLookUpName)
        })
        .toArray()

      _.pullAll(changes, relevantChanges)
      changesToReturn.forEach(change => changes.push(change))
    },
  }
}

export default filter
