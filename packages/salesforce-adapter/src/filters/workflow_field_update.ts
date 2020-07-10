/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import {
  Element, ReferenceExpression, Field, ElemID, Values, isReferenceExpression,
} from '@salto-io/adapter-api'
import {
  findInstances,
} from '@salto-io/adapter-utils'
import { apiName } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import {
  parentApiName, generateApiNameToCustomObject, allCustomObjectFields,
} from './utils'
import { SALESFORCE, WORKFLOW_FIELD_UPDATE_METADATA_TYPE } from '../constants'

const log = logger(module)

export const WORKFLOW_FIELD_UPDATE_TYPE_ID = new ElemID(
  SALESFORCE,
  WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
)

export type WorkflowFieldUpdate = Values & {
  field: string | ReferenceExpression
}

const isWorkflowFieldUpdate = (value: Values): value is WorkflowFieldUpdate => (
  value !== undefined && (_.isString(value.field) || isReferenceExpression(value.field))
)

const findField = (fieldName: string, fields: Field[]): Field | undefined => (
  fields.find(field => apiName(field, true) === fieldName)
)

/**
 * Replace the action name with a reference, based on the parent and action type.
 *
 * @param entry           The WorkflowFieldUpdate instance to update
 * @param parentObjFields All known fields in the referenced object
 * @param parentObjName   The name of the referenced (parent) object
 */
const convertFieldToReference = (
  entry: WorkflowFieldUpdate,
  parentObjFields: Field[],
  parentObjName: string,
): void => {
  if (entry === undefined) return

  const reference = findField(
    entry.field as string,
    parentObjFields,
  )
  if (reference === undefined) {
    log.debug(`Could not find field ${entry.field} in ${parentObjName}`)
    return
  }

  entry.field = new ReferenceExpression(
    reference.elemID
  )
}

/**
* Declare the WorkflowFieldUpdate filter, which converts the field name to a reference.
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Fixes WorkflowFieldUpdate field references.
   *
   * @param elements  The already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const apiNameToCustomObject = generateApiNameToCustomObject(elements)
    const instances = [...findInstances(elements, WORKFLOW_FIELD_UPDATE_TYPE_ID)]

    instances.forEach(instance => {
      if (!isWorkflowFieldUpdate(instance.value)) {
        return
      }

      const parentObjName = parentApiName(instance)
      const parentObj = apiNameToCustomObject.get(parentObjName)
      if (parentObj === undefined) {
        log.debug(`Could not find parent object ${parentObjName} for WorkflowFieldUpdate ${instance.elemID.getFullName()}`)
        return
      }

      const parentObjFields = [...allCustomObjectFields(elements, parentObj.elemID)]
      convertFieldToReference(
        instance.value,
        parentObjFields,
        parentObjName,
      )
    })
  },
})

export default filterCreator
