/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  Field,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  ListType,
  ObjectType,
  Values,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { elements as elementUtils, resolveValues, restoreChangeElement } from '@salto-io/adapter-components'
import _ from 'lodash'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { getWorkflowChanges, isWorkflowV1Instance, WorkflowV1Instance } from './types'
import { JIRA, WORKFLOW_STATUS_TYPE_NAME, WORKFLOW_TRANSITION_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'

const PROPERTY_TYPE_NAME = 'WorkflowProperty'

const { awu } = collections.asynciterable

const convertPropertiesToList = (instance: WorkflowV1Instance): void => {
  ;[...(instance.value.statuses ?? []), ...(Object.values(instance.value.transitions) ?? [])].forEach(item => {
    if (item.properties !== undefined) {
      item.properties = Object.entries(item.properties).map(([key, value]) => ({ key, value }))
    }
  })
}

const convertPropertiesToMap = (instance: WorkflowV1Instance): void => {
  ;[...(instance.value.statuses ?? []), ...(Object.values(instance.value.transitions) ?? [])].forEach(item => {
    if (item.properties !== undefined) {
      item.properties = Object.fromEntries(item.properties.map(({ key, value }: Values) => [key, value]))
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
        workflowTransitionType.fields.properties = new Field(
          workflowTransitionType,
          'properties',
          new ListType(propertyType),
          {
            [CORE_ANNOTATIONS.CREATABLE]: true,
            [CORE_ANNOTATIONS.UPDATABLE]: true,
            [CORE_ANNOTATIONS.DELETABLE]: true,
          },
        )
      }

      elements.filter(isInstanceElement).filter(isWorkflowV1Instance).forEach(convertPropertiesToList)
    },

    preDeploy: async changes => {
      const relevantChanges = getWorkflowChanges(changes)

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          originalChanges[getChangeData(change).elemID.getFullName()] = change
          return applyFunctionToChangeData<Change<WorkflowV1Instance>>(change, async instance => {
            // I have to call resolveValues here because after I change the status
            // properties structure the getLookUpName won't know how to resolve
            // the references inside correctly
            const resolvedInstance = await resolveValues(instance, getLookUpName)
            convertPropertiesToMap(resolvedInstance)
            return resolvedInstance
          })
        })
        .toArray()

      _.pullAll(changes, relevantChanges)
      changesToReturn.forEach(change => changes.push(change))
    },

    onDeploy: async changes => {
      const relevantChanges = getWorkflowChanges(changes)

      const changesToReturn = await awu(relevantChanges)
        .map(async change => {
          await applyFunctionToChangeData<Change<WorkflowV1Instance>>(change, instance => {
            convertPropertiesToList(instance)
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
