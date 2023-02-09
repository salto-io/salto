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
import { Element, ObjectType, ListType, InstanceElement, isAdditionOrModificationChange, getChangeData, Change, ChangeDataType, isListType, Field, isPrimitiveType, isObjectTypeChange, StaticFile, isFieldChange, isAdditionChange, isInstanceElement, createRefToElmWithValue } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../../filter'
import { isInstanceOfTypeChange } from '../utils'
import { CPQ_CUSTOM_SCRIPT, CPQ_CONSUMPTION_SCHEDULE_FIELDS, CPQ_GROUP_FIELDS, CPQ_QUOTE_FIELDS, CPQ_QUOTE_LINE_FIELDS, CPQ_CONSUMPTION_RATE_FIELDS, CPQ_CODE_FIELD } from '../../constants'
import { Types, apiName, isInstanceOfCustomObject, isCustomObject } from '../../transformers/transformer'

const { awu } = collections.asynciterable

const log = logger(module)

const refListFieldNames = [
  CPQ_CONSUMPTION_RATE_FIELDS, CPQ_CONSUMPTION_SCHEDULE_FIELDS, CPQ_GROUP_FIELDS,
  CPQ_QUOTE_FIELDS, CPQ_QUOTE_LINE_FIELDS,
]

const listOfText = new ListType(Types.primitiveDataTypes.Text)

const fieldTypeFromTextListToLongText = async (field: Field): Promise<Field> => {
  const fieldType = await field.getType()
  if (isListType(fieldType) && fieldType.isEqual(listOfText)) {
    field.refType = createRefToElmWithValue(Types.primitiveDataTypes.LongTextArea)
  }
  return field
}

const fieldTypeFromLongTextToTextList = async (field: Field): Promise<Field> => {
  const fieldType = await field.getType()
  if (isPrimitiveType(fieldType)
    && fieldType.isEqual(Types.primitiveDataTypes.LongTextArea)) {
    field.refType = createRefToElmWithValue(listOfText)
  }
  return field
}

const refListFieldsToLongText = async (cpqCustomScriptObject: ObjectType): Promise<ObjectType> => {
  await awu(Object.values(cpqCustomScriptObject.fields))
    .filter(async field => refListFieldNames.includes(await apiName(field, true)))
    .forEach(fieldTypeFromTextListToLongText)
  return cpqCustomScriptObject
}

const refListFieldsToTextLists = async (cpqCustomScriptObject: ObjectType): Promise<ObjectType> => {
  await awu(Object.values(cpqCustomScriptObject.fields))
    .filter(async field => refListFieldNames.includes(await apiName(field, true)))
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

const isInstanceOfCustomScript = async (element: Element): Promise<boolean> =>
  (isInstanceElement(element)
    && await isInstanceOfCustomObject(element)
    && await apiName(await element.getType()) === CPQ_CUSTOM_SCRIPT)

const isCustomScriptType = async (objType: ObjectType): Promise<boolean> =>
  await isCustomObject(objType) && await apiName(objType) === CPQ_CUSTOM_SCRIPT

const getCustomScriptObjectChange = async (
  changes: ReadonlyArray<Change<ChangeDataType>>
): Promise<Change<ObjectType> | undefined> =>
  awu(changes)
    .filter(isObjectTypeChange)
    .find(change => isCustomScriptType(getChangeData(change) as ObjectType))

const applyFuncOnCustomScriptInstanceChanges = async (
  changes: ReadonlyArray<Change<ChangeDataType>>,
  fn: (inst: InstanceElement) => InstanceElement
): Promise<void> => {
  await awu(changes)
    .filter(isInstanceOfTypeChange(CPQ_CUSTOM_SCRIPT))
    .forEach(
      customScriptInstanceChange => applyFunctionToChangeData(
        customScriptInstanceChange as Change<InstanceElement>,
        fn
      )
    )
}

const applyFuncOnCustomScriptObjectChange = async (
  changes: ReadonlyArray<Change<ChangeDataType>>,
  fn: (customScriptObject: ObjectType) => Promise<ObjectType>
): Promise<void> => {
  const customScriptObjectChange = await getCustomScriptObjectChange(changes)
  if (customScriptObjectChange !== undefined) {
    await applyFunctionToChangeData(customScriptObjectChange, fn)
  }
}

const applyFuncOnCustomScriptFieldChange = async (
  changes: ReadonlyArray<Change>,
  fn: (customScriptField: Field) => Field | Promise<Field>
): Promise<void> => {
  await awu(changes)
    .filter<Change<Field>>(isFieldChange)
    .filter(change => isCustomScriptType(getChangeData(change).parent))
    .filter(
      async change => refListFieldNames.includes(await apiName(getChangeData(change), true))
    )
    .forEach(change => applyFunctionToChangeData(change, fn))
}

const filter: LocalFilterCreator = () => ({
  name: 'cpqCustomScriptFilter',
  onFetch: async (elements: Element[]) => {
    const customObjects = await awu(elements).filter(isCustomObject).toArray() as ObjectType[]
    const cpqCustomScriptObject = await awu(customObjects)
      .find(async obj => await apiName(obj) === CPQ_CUSTOM_SCRIPT)
    if (cpqCustomScriptObject === undefined) {
      return
    }
    await refListFieldsToTextLists(cpqCustomScriptObject)
    const cpqCustomScriptInstances = await awu(elements)
      .filter(isInstanceOfCustomScript)
      .toArray() as InstanceElement[]
    log.debug(`Transforming ${cpqCustomScriptInstances.length} instances of SBQQ__CustomScript`)
    cpqCustomScriptInstances.forEach((instance, index) => {
      refListValuesToArray(instance)
      codeValueToFile(instance)
      if (index % 100 === 0) {
        log.debug(`Transformed ${index} instances of SBQQ__CustomScript`)
      }
    })
  },
  preDeploy: async changes => {
    const addOrModifyChanges = changes.filter(isAdditionOrModificationChange)
    await applyFuncOnCustomScriptInstanceChanges(addOrModifyChanges, transformInstanceToSFValues)
    await applyFuncOnCustomScriptObjectChange(
      // Fields are taken from object changes only when the object is added
      addOrModifyChanges.filter(isAdditionChange),
      refListFieldsToLongText
    )
    await applyFuncOnCustomScriptFieldChange(
      addOrModifyChanges,
      fieldTypeFromTextListToLongText
    )
  },
  onDeploy: async changes => {
    const addOrModifyChanges = changes.filter(isAdditionOrModificationChange)
    await applyFuncOnCustomScriptInstanceChanges(addOrModifyChanges, refListValuesToArray)
    await applyFuncOnCustomScriptObjectChange(
      // Fields are taken from object changes only when the object is added
      addOrModifyChanges.filter(isAdditionChange),
      refListFieldsToTextLists,
    )
    await applyFuncOnCustomScriptFieldChange(addOrModifyChanges, fieldTypeFromLongTextToTextList)
  },
})

export default filter
