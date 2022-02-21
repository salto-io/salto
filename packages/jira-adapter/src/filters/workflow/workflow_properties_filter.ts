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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, Element, ElemID, Field, getChangeData, isInstanceChange, isInstanceElement, ListType, ObjectType, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, WorkflowInstance } from './types'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../constants'

const STATUS_PROPERTY_TYPE_NAME = 'StatusProperty'

const { awu } = collections.asynciterable

const log = logger(module)

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


const filter: FilterCreator = () => ({
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
    if (workflowStatusType === undefined) {
      log.warn('WorkflowStatus type was not received in fetch')
    } else {
      workflowStatusType.fields.properties = new Field(workflowStatusType, 'properties', new ListType(propertyType), { [CORE_ANNOTATIONS.REQUIRED]: true })
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(isWorkflowInstance)
      .forEach(convertStatusesPropertiesToList)
  },

  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(change => isWorkflowInstance(getChangeData(change)))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<WorkflowInstance>>(
          change,
          instance => {
            convertStatusesPropertiesToMap(instance)
            return instance
          }
        )
      })
  },

  onDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(change => isWorkflowInstance(getChangeData(change)))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<WorkflowInstance>>(
          change,
          instance => {
            convertStatusesPropertiesToList(instance)
            return instance
          }
        )
      })
  },
})

export default filter
