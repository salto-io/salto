/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, Element, ElemID, Field, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, ListType, ObjectType, Values } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, resolveValues, restoreChangeElement } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, WorkflowInstance } from './types'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'

const STATUS_PROPERTY_TYPE_NAME = 'StatusProperty'

const { awu } = collections.asynciterable

const convertStatusesPropertiesToList = (instance: WorkflowInstance): void => {
  instance.value.statuses?.forEach(status => {
    if (status.properties !== undefined) {
      status.properties = Object.entries(status.properties)
        .map(([key, value]) => ({ key, value }))
    }
  })
}

const convertStatusesPropertiesToMap = (instance: WorkflowInstance): void => {
  instance.value.statuses?.forEach(status => {
    if (status.properties !== undefined) {
      status.properties = Object.fromEntries(
        status.properties.map(({ key, value }: Values) => [key, value])
      )
    }
  })
}


const filter: FilterCreator = () => {
  const originalChanges: Record<string, Change<InstanceElement>> = {}

  return {
    onFetch: async (elements: Element[]) => {
      const propertyType = new ObjectType({
        elemID: new ElemID(JIRA, STATUS_PROPERTY_TYPE_NAME),
        fields: {
          key: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
          },
          value: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
          },
        },
        path: [JIRA, elementUtils.TYPES_PATH, STATUS_PROPERTY_TYPE_NAME],
      })

      elements.push(propertyType)

      const workflowStatusType = findObject(elements, 'WorkflowStatus')
      if (workflowStatusType !== undefined) {
        workflowStatusType.fields.properties = new Field(workflowStatusType, 'properties', new ListType(propertyType), { [CORE_ANNOTATIONS.REQUIRED]: true })
      }

      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .filter(isWorkflowInstance)
        .forEach(convertStatusesPropertiesToList)
    },

    preDeploy: async changes => {
      const relevantChanges = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
        .filter(change => isWorkflowInstance(getChangeData(change)))

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
              convertStatusesPropertiesToMap(resolvedInstance)
              return resolvedInstance
            }
          )
        })
        .toArray()

      _.pullAll(changes, relevantChanges)
      changesToReturn.forEach(change => changes.push(change))
    },

    onDeploy: async changes => {
      const relevantChanges = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
        .filter(change => isWorkflowInstance(getChangeData(change)))

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          await applyFunctionToChangeData<Change<WorkflowInstance>>(
            change,
            instance => {
              convertStatusesPropertiesToList(instance)
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
