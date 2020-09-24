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
import { Element, ObjectType, ListType, InstanceElement, isAdditionOrModificationChange, isInstanceChange, getChangeElement, Change, ChangeDataType, isListType, Field, isPrimitiveType, isFieldChange, isObjectTypeChange, StaticFile, isStaticFile } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { getCustomObjects } from '../utils'
import { CPQ_CUSTOM_SCRIPT, CPQ_CONSUMPTION_SCHEDULE_FIELDS, CPQ_GROUP_FIELDS, CPQ_QUOTE_FIELDS, CPQ_QUOTE_LINE_FIELDS, CPQ_CONSUMPTION_RATE_FIELDS, CPQ_CODE_FIELD } from '../../constants'
import { Types, apiName, isInstanceOfCustomObject, isCustomObject } from '../../transformers/transformer'

export const refListFieldsToObject: Record<string, string> = {
  [CPQ_CONSUMPTION_RATE_FIELDS]: 'ConsumptionRate',
  [CPQ_CONSUMPTION_SCHEDULE_FIELDS]: 'ConsumptionSchedule',
  [CPQ_GROUP_FIELDS]: 'SBQQ__QuoteLineGroup__c',
  [CPQ_QUOTE_FIELDS]: 'SBQQ__QuoteLine__c',
  [CPQ_QUOTE_LINE_FIELDS]: 'SBQQ__Quote__c',
}

const refListFieldNames = Object.keys(refListFieldsToObject)
const listOfText = new ListType(Types.primitiveDataTypes.Text)

const fieldTypeFromTextListToLongText = (field: Field): Field => {
  if (isListType(field.type) && field.type.isEqual(listOfText)) {
    field.type = Types.primitiveDataTypes.LongTextArea
  }
  return field
}

const fieldTypeFromLongTextToTextList = (field: Field): Field => {
  if (isPrimitiveType(field.type) && field.type.isEqual(Types.primitiveDataTypes.LongTextArea)) {
    field.type = listOfText
  }
  return field
}

const refListFieldsToTextLists = (cpqCustomScriptObject: ObjectType): ObjectType => {
  Object.values(cpqCustomScriptObject.fields)
    .filter(field => refListFieldNames.includes(apiName(field, true)))
    .forEach(fieldTypeFromLongTextToTextList)
  return cpqCustomScriptObject
}

const transformInstanceToSaltoValues = (
  cpqCustomScriptInstance: InstanceElement
): InstanceElement => {
  refListFieldNames.forEach(fieldName => {
    const fieldValue = cpqCustomScriptInstance.value[fieldName]
    if (_.isString(fieldValue)) {
      cpqCustomScriptInstance.value[fieldName] = fieldValue.split(/\r?\n/)
    }
  })
  if (_.isString(cpqCustomScriptInstance.value[CPQ_CODE_FIELD])) {
    cpqCustomScriptInstance.value[CPQ_CODE_FIELD] = new StaticFile({
      filepath: (cpqCustomScriptInstance.path ?? []).join('/'),
      content: Buffer.from(cpqCustomScriptInstance.value[CPQ_CODE_FIELD]),
    })
  }
  return cpqCustomScriptInstance
}

const transformInstanceToSFValues = (
  cpqCustomScriptInstance: InstanceElement
): InstanceElement => {
  refListFieldNames.forEach(fieldName => {
    const fieldValue = cpqCustomScriptInstance.value[fieldName]
    if (Array.isArray(fieldValue) && fieldValue.every(_.isString)) {
      cpqCustomScriptInstance.value[fieldName] = fieldValue.join('\n')
    }
  })
  // TODO: Remove this when SALTO-881 is done
  const codeValue = cpqCustomScriptInstance.value[CPQ_CODE_FIELD]
  if (isStaticFile(codeValue) && codeValue.content !== undefined) {
    cpqCustomScriptInstance.value[CPQ_CODE_FIELD] = codeValue.content.toString('utf8')
  }
  return cpqCustomScriptInstance
}

const isInstanceOfCustomScript = (element: Element): element is InstanceElement =>
  (isInstanceOfCustomObject(element) && apiName(element.type) === CPQ_CUSTOM_SCRIPT)

const getCustomScriptInstanceChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): ReadonlyArray<Change<InstanceElement>> =>
  (changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change =>
      (isInstanceOfCustomScript(getChangeElement(change)))))

const getCustomScriptObjectChange = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): Change<ObjectType> | undefined =>
  (changes
    .filter(isAdditionOrModificationChange)
    .filter(isObjectTypeChange)
    .find(change =>
      ((isCustomObject(getChangeElement(change))
        && apiName(getChangeElement(change)) === CPQ_CUSTOM_SCRIPT))))

const getRefListFieldChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): ReadonlyArray<Change<Field>> =>
  (changes
    .filter(isAdditionOrModificationChange)
    .filter(isFieldChange)
    .filter(change =>
      refListFieldNames.includes(apiName(getChangeElement(change), true))))

const applyFuncOnCustomScriptInstanceChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>,
  fn: (inst: InstanceElement) => InstanceElement
): void => {
  const customScriptInstanceChanges = getCustomScriptInstanceChanges(changes)
  customScriptInstanceChanges.forEach(customScriptInstanceChange =>
    applyFunctionToChangeData(
      customScriptInstanceChange,
      fn
    ))
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = getCustomObjects(elements)
    const cpqCustomScriptObject = customObjects.find(obj => apiName(obj) === CPQ_CUSTOM_SCRIPT)
    if (cpqCustomScriptObject === undefined) {
      return
    }
    refListFieldsToTextLists(cpqCustomScriptObject)
    const cpqCustomScriptInstances = elements.filter(isInstanceOfCustomScript)
    cpqCustomScriptInstances.forEach(transformInstanceToSaltoValues)
  },
  preDeploy: async changes => {
    applyFuncOnCustomScriptInstanceChanges(changes, transformInstanceToSFValues)
    const refListFieldChanges = getRefListFieldChanges(changes)
    refListFieldChanges.forEach(refListFieldChange =>
      applyFunctionToChangeData(
        refListFieldChange,
        fieldTypeFromTextListToLongText,
      ))
  },
  onDeploy: async changes => {
    applyFuncOnCustomScriptInstanceChanges(changes, transformInstanceToSaltoValues)
    const customScriptObjectChange = getCustomScriptObjectChange(changes)
    if (customScriptObjectChange !== undefined) {
      applyFunctionToChangeData(
        customScriptObjectChange,
        refListFieldsToTextLists,
      )
    }
    return []
  },
})

export default filter
