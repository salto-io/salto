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
import { Element, ObjectType, ListType, InstanceElement, isAdditionOrModificationChange, getChangeElement, Change, ChangeDataType, isListType, Field, isPrimitiveType, isObjectTypeChange, StaticFile, isFieldChange, isAdditionChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { isInstanceOfTypeChange } from '../utils'
import { CPQ_CUSTOM_SCRIPT, CPQ_CONSUMPTION_SCHEDULE_FIELDS, CPQ_GROUP_FIELDS, CPQ_QUOTE_FIELDS, CPQ_QUOTE_LINE_FIELDS, CPQ_CONSUMPTION_RATE_FIELDS, CPQ_CODE_FIELD } from '../../constants'
import { Types, apiName, isInstanceOfCustomObject, isCustomObject } from '../../transformers/transformer'


const refListFieldNames = [
  CPQ_CONSUMPTION_RATE_FIELDS, CPQ_CONSUMPTION_SCHEDULE_FIELDS, CPQ_GROUP_FIELDS,
  CPQ_QUOTE_FIELDS, CPQ_QUOTE_LINE_FIELDS,
]

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

const refListFieldsToLongText = (cpqCustomScriptObject: ObjectType): ObjectType => {
  Object.values(cpqCustomScriptObject.fields)
    .filter(field => refListFieldNames.includes(apiName(field, true)))
    .forEach(fieldTypeFromTextListToLongText)
  return cpqCustomScriptObject
}

const refListFieldsToTextLists = (cpqCustomScriptObject: ObjectType): ObjectType => {
  Object.values(cpqCustomScriptObject.fields)
    .filter(field => refListFieldNames.includes(apiName(field, true)))
    .forEach(fieldTypeFromLongTextToTextList)
  return cpqCustomScriptObject
}

const refListValuesToArray = (
  cpqCustomScriptInstance: InstanceElement
): InstanceElement => {
  refListFieldNames.forEach(fieldName => {
    const fieldValue = cpqCustomScriptInstance.value[fieldName]
    if (_.isString(fieldValue)) {
      cpqCustomScriptInstance.value[fieldName] = fieldValue.split(/\r?\n/)
    }
  })
  return cpqCustomScriptInstance
}

const codeValueToFile = (
  cpqCustomScriptInstance: InstanceElement
): InstanceElement => {
  if (_.isString(cpqCustomScriptInstance.value[CPQ_CODE_FIELD])) {
    cpqCustomScriptInstance.value[CPQ_CODE_FIELD] = new StaticFile({
      filepath: `${(cpqCustomScriptInstance.path ?? []).join('/')}.js`,
      content: Buffer.from(cpqCustomScriptInstance.value[CPQ_CODE_FIELD]),
      encoding: 'utf-8',
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
  return cpqCustomScriptInstance
}

const isInstanceOfCustomScript = (element: Element): element is InstanceElement =>
  (isInstanceOfCustomObject(element) && apiName(element.getType()) === CPQ_CUSTOM_SCRIPT)

const isCustomScriptType = (objType: ObjectType): boolean =>
  isCustomObject(objType) && apiName(objType) === CPQ_CUSTOM_SCRIPT

const getCustomScriptObjectChange = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): Change<ObjectType> | undefined =>
  changes
    .filter(isObjectTypeChange)
    .find(change => isCustomScriptType(getChangeElement(change) as ObjectType))

const applyFuncOnCustomScriptInstanceChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>,
  fn: (inst: InstanceElement) => InstanceElement
): void => {
  changes
    .filter(isInstanceOfTypeChange(CPQ_CUSTOM_SCRIPT))
    .forEach(
      customScriptInstanceChange => applyFunctionToChangeData(customScriptInstanceChange, fn)
    )
}

const applyFuncOnCustomScriptObjectChange = (
  changes: ReadonlyArray<Change<ChangeDataType>>,
  fn: (customScriptObject: ObjectType) => ObjectType
): void => {
  const customScriptObjectChange = getCustomScriptObjectChange(changes)
  if (customScriptObjectChange !== undefined) {
    applyFunctionToChangeData(customScriptObjectChange, fn)
  }
}

const applyFuncOnCustomScriptFieldChange = (
  changes: ReadonlyArray<Change>,
  fn: (customScriptField: Field) => Field
): void => {
  changes
    .filter<Change<Field>>(isFieldChange)
    .filter(change => isCustomScriptType(getChangeElement(change).parent))
    .filter(change => refListFieldNames.includes(apiName(getChangeElement(change), true)))
    .map(change => applyFunctionToChangeData(change, fn))
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = elements.filter(isCustomObject)
    const cpqCustomScriptObject = customObjects.find(obj => apiName(obj) === CPQ_CUSTOM_SCRIPT)
    if (cpqCustomScriptObject === undefined) {
      return
    }
    refListFieldsToTextLists(cpqCustomScriptObject)
    const cpqCustomScriptInstances = elements.filter(isInstanceOfCustomScript)
    cpqCustomScriptInstances.forEach(instance => {
      refListValuesToArray(instance)
      codeValueToFile(instance)
    })
  },
  preDeploy: async changes => {
    const addOrModifyChanges = changes.filter(isAdditionOrModificationChange)
    applyFuncOnCustomScriptInstanceChanges(addOrModifyChanges, transformInstanceToSFValues)
    applyFuncOnCustomScriptObjectChange(
      // Fields are taken from object changes only when the object is added
      addOrModifyChanges.filter(isAdditionChange),
      refListFieldsToLongText
    )
    applyFuncOnCustomScriptFieldChange(addOrModifyChanges, fieldTypeFromTextListToLongText)
  },
  onDeploy: async changes => {
    const addOrModifyChanges = changes.filter(isAdditionOrModificationChange)
    applyFuncOnCustomScriptInstanceChanges(addOrModifyChanges, refListValuesToArray)
    applyFuncOnCustomScriptObjectChange(
      // Fields are taken from object changes only when the object is added
      addOrModifyChanges.filter(isAdditionChange),
      refListFieldsToTextLists,
    )
    applyFuncOnCustomScriptFieldChange(addOrModifyChanges, fieldTypeFromLongTextToTextList)
    return []
  },
})

export default filter
