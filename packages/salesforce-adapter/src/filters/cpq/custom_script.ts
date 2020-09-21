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
import { Element, ObjectType, ListType, InstanceElement, isAdditionOrModificationChange, isInstanceChange, getChangeElement, Change, ChangeDataType } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { getCustomObjects } from '../utils'
import { CPQ_CUSTOM_SCRIPT, CPQ_CONSUMPTION_SCHEDULE_FIELDS, CPQ_GROUP_FIELS, CPQ_QUOTE_FIELDS, CPQ_QUOTE_LINE_FIELDS, CPQ_CONSUMPTION_RATE_FIELDS } from '../../constants'
import { Types, apiName, isInstanceOfCustomObject } from '../../transformers/transformer'

export const refListFieldsToObject: Record<string, string> = {
  [CPQ_CONSUMPTION_RATE_FIELDS]: 'ConsumptionRate',
  [CPQ_CONSUMPTION_SCHEDULE_FIELDS]: 'ConsumptionSchedule',
  [CPQ_GROUP_FIELS]: 'SBQQ__QuoteLineGroup__c',
  [CPQ_QUOTE_FIELDS]: 'SBQQ__QuoteLine__c',
  [CPQ_QUOTE_LINE_FIELDS]: 'SBQQ__Quote__c',
}

const refListFieldNames = Object.keys(refListFieldsToObject)

const changeRefListFieldsType = (cpqCustomScriptObject: ObjectType): void => {
  Object.values(cpqCustomScriptObject.fields)
    .filter(field => refListFieldNames.includes(apiName(field)))
    .forEach(field => {
      field.type = new ListType(Types.primitiveDataTypes.Text)
    })
}

const refListValuesToList = (cpqCustomScriptInstance: InstanceElement): InstanceElement => {
  refListFieldNames.forEach(fieldName => {
    const fieldValue = cpqCustomScriptInstance.value[fieldName]
    if (_.isString(fieldValue)) {
      cpqCustomScriptInstance.value[fieldName] = fieldValue.split('\r\n')
    }
  })
  return cpqCustomScriptInstance
}

const refListValuesToString = (cpqCustomScriptInstance: InstanceElement): InstanceElement => {
  refListFieldNames.forEach(fieldName => {
    const fieldValue = cpqCustomScriptInstance.value[fieldName]
    if (Array.isArray(fieldValue) && fieldValue.every(_.isString)) {
      cpqCustomScriptInstance.value[fieldName] = fieldValue.join('\r\n')
    }
  })
  return cpqCustomScriptInstance
}

const isInstanceOfCustomScript = (instance: InstanceElement): boolean =>
  (apiName(instance.type) === CPQ_CUSTOM_SCRIPT)

const getCustomScriptInstanceChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): ReadonlyArray<Change<InstanceElement>> =>
  (changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change =>
      (isInstanceOfCustomScript(getChangeElement(change)))))

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = getCustomObjects(elements)
    const cpqCustomScriptObject = customObjects.find(obj => apiName(obj) === CPQ_CUSTOM_SCRIPT)
    if (cpqCustomScriptObject === undefined) {
      return
    }
    changeRefListFieldsType(cpqCustomScriptObject)
    const cpqCustomScriptInstances = elements
      .filter(isInstanceOfCustomObject)
      .filter(isInstanceOfCustomScript)
    cpqCustomScriptInstances.forEach(refListValuesToList)
  },
  preDeploy: async changes => {
    const customScriptInstanceChanges = getCustomScriptInstanceChanges(changes)
    customScriptInstanceChanges.forEach(customScriptInstanceChange =>
      applyFunctionToChangeData(
        customScriptInstanceChange,
        changeData => refListValuesToString(changeData)
      ))
  },
  onDeploy: async changes => {
    const customScriptInstanceChanges = getCustomScriptInstanceChanges(changes)
    customScriptInstanceChanges.forEach(customScriptInstanceChange =>
      applyFunctionToChangeData(
        customScriptInstanceChange,
        changeData => refListValuesToList(changeData)
      ))
    return []
  },
})

export default filter
