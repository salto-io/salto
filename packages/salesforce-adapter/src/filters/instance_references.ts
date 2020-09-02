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
import {
  Field, Element, isObjectType, isInstanceElement, Value, Values, ObjectType, ElemID,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import {
  TransformFunc, transformValues,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { SALESFORCE, CUSTOM_OBJECT, CUSTOM_FIELD } from '../constants'
import { apiName, isCustomObject, metadataType } from '../transformers/transformer'

// ApiName -> MetadataType -> ElemID
export type ApiNameMapping = Record<string, Record<string, ElemID>>

const fieldToTypeMappingDefs: Array<[ElemID, string]> = [
  [new ElemID(SALESFORCE, 'ProfileApplicationVisibility', 'field', 'application'), 'CustomApplication'],
  [new ElemID(SALESFORCE, 'ProfileLayoutAssignment', 'field', 'layout'), 'Layout'],
  [new ElemID(SALESFORCE, 'ProfileFlowAccess', 'field', 'flow'), 'Flow'],
  [new ElemID(SALESFORCE, 'ProfileRecordTypeVisibility', 'field', 'recordType'), 'RecordType'],
  [new ElemID(SALESFORCE, 'CustomApplication', 'field', 'tabs'), 'CustomTab'],
  [new ElemID(SALESFORCE, 'WorkspaceMapping', 'field', 'tab'), 'CustomTab'],
  [new ElemID(SALESFORCE, 'FlowVariable', 'field', 'objectType'), CUSTOM_OBJECT],
  [new ElemID(SALESFORCE, 'ObjectSearchSetting', 'field', 'name'), CUSTOM_OBJECT],
  [new ElemID(SALESFORCE, 'ProfileFieldLevelSecurity', 'field', 'field'), CUSTOM_FIELD],
  [new ElemID(SALESFORCE, 'ProfileObjectPermissions', 'field', 'object'), CUSTOM_OBJECT],
  [new ElemID(SALESFORCE, 'FlowActionCall', 'field', 'actionName'), 'WorkflowAlert'],
  [new ElemID(SALESFORCE, 'WorkflowEmailRecipient', 'field', 'recipient'), 'Role'],
  [new ElemID(SALESFORCE, 'FilterItem', 'field', 'field'), CUSTOM_FIELD],
  [new ElemID(SALESFORCE, 'DashboardComponent', 'field', 'report'), 'Report'],
  [new ElemID(SALESFORCE, 'Report', 'field', 'reportType'), CUSTOM_OBJECT],
  [new ElemID(SALESFORCE, 'CustomSite', 'field', 'authorizationRequiredPage'), 'ApexPage'],
  [new ElemID(SALESFORCE, 'CustomSite', 'field', 'bandwidthExceededPage'), 'ApexPage'],
  [new ElemID(SALESFORCE, 'CustomSite', 'field', 'fileNotFoundPage'), 'ApexPage'],
  [new ElemID(SALESFORCE, 'CustomSite', 'field', 'genericErrorPage'), 'ApexPage'],
  [new ElemID(SALESFORCE, 'CustomSite', 'field', 'indexPage'), 'ApexPage'],
  [new ElemID(SALESFORCE, 'CustomSite', 'field', 'inMaintenancePage'), 'ApexPage'],
  [new ElemID(SALESFORCE, 'CustomSite', 'field', 'selfRegPage'), 'ApexPage'],
  [new ElemID(SALESFORCE, 'SBQQ__PriceRule__c', 'field', 'SBQQ__LookupObject__c'), CUSTOM_OBJECT],
  [new ElemID(SALESFORCE, 'SBQQ__ProductRule__c', 'field', 'SBQQ__LookupObject__c'), CUSTOM_OBJECT],
  [new ElemID(SALESFORCE, 'SBQQ__FieldMetadata__c', 'field', 'SBQQ__ObjectName__c'), CUSTOM_OBJECT],
]

export const fieldToTypeMapping = new Map(
  fieldToTypeMappingDefs.map(([fieldID, typeName]) => [fieldID.getFullName(), typeName])
)

const mapElemTypeToElemID = (elements: Element[]): Record<string, ElemID> =>
  (Object.fromEntries(elements.map(e => [metadataType(e), e.elemID])))

export const groupByAPIName = (elements: Element[]): ApiNameMapping => (
  _(elements)
    .map<Element[]>(e => ((isObjectType(e) && isCustomObject(e))
      ? [e, ...Object.values(e.fields)] : [e]))
    .flatten()
    .groupBy(apiName)
    .mapValues(mapElemTypeToElemID)
    .value()
)

const replaceReferenceValues = (
  values: Values,
  refElement: ObjectType,
  replaceTypes: Map<string, string>,
  apiToIdMap: ApiNameMapping
): Values => {
  const shouldReplace = (field: Field): boolean => (
    replaceTypes.has(field.elemID.getFullName())
  )

  const replacePrimitive = (val: Value, field: Field): Value => {
    if (!_.isString(val)) {
      return val
    }
    const elemIDMap = apiToIdMap[val]
    if (elemIDMap === undefined) {
      return val
    }

    const targetType = replaceTypes.get(field.elemID.getFullName())
    if (targetType === undefined) {
      return val
    }

    const elemID = elemIDMap[targetType]
    if (elemID === undefined) {
      return val
    }

    return new ReferenceExpression(elemID)
  }

  const transformPrimitive: TransformFunc = ({ value, field }) => (
    (field !== undefined && shouldReplace(field)) ? replacePrimitive(value, field) : value
  )

  return transformValues(
    {
      values,
      type: refElement,
      transformFunc: transformPrimitive,
      strict: false,
    }
  ) || values
}

export const replaceInstances = (elements: Element[], fieldToTypeMap: Map<string, string>):
void => {
  const apiNameToElemIDs = groupByAPIName(elements)
  elements.filter(isInstanceElement).forEach(instance => {
    instance.value = replaceReferenceValues(
      instance.value,
      instance.type,
      fieldToTypeMap,
      apiNameToElemIDs
    )
  })
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    replaceInstances(elements, fieldToTypeMapping)
  },
})

export default filter
