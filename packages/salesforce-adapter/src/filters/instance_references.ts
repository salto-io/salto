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
import { Field, Element, isObjectType, isInstanceElement, Value, Values, ObjectType, ElemID, ReferenceExpression, TransformValueFunc, transform } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { SALESFORCE, CUSTOM_OBJECT, CUSTOM_FIELD } from '../constants'
import { apiName, isCustomObject, metadataType } from '../transformers/transformer'

// ApiName -> MetadataType -> ElemID
type ApiNameMapping = Record<string, Record<string, ElemID>>

const fieldToTypeMappingDefs: Array<[ElemID, string]> = [
  [new ElemID(SALESFORCE, 'Role', 'field', 'parentRole'), 'Role'],
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

  // [new ElemID(SALESFORCE, 'Role', 'field', 'parentRole'), 'WorkflowAlert'],
]

export const fieldToTypeMapping = new Map(
  fieldToTypeMappingDefs.map(([fieldID, typeName]) => [fieldID.getFullName(), typeName])
)

const mapElemTypeToElemID = (elements: Element[]): Record<string, ElemID> => (
  _(elements)
    .map(e => [metadataType(e), e.elemID])
    .fromPairs()
    .value()
)

export const groupByAPIName = (elements: Element[]): ApiNameMapping => (
  _(elements)
    .map<Element[]>(e => ((isObjectType(e) && isCustomObject(e))
      ? [e, ..._.values(e.fields)] : [e]))
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
    !_.isUndefined(field) && replaceTypes.has(field.elemID.getFullName())
  )

  const replacePrimitive = (val: Value, field: Field): Value => {
    const elemIDMap = apiToIdMap[val]
    if (_.isUndefined(elemIDMap)) {
      return val
    }

    const targetType = replaceTypes.get(field.elemID.getFullName())
    if (_.isUndefined(targetType)) {
      return val
    }

    const elemID = elemIDMap[targetType]
    if (_.isUndefined(elemID)) {
      return val
    }

    return _.isString(val) ? new ReferenceExpression(elemID) : val
  }

  const transformReferences: TransformValueFunc = (val, field) => (
    field !== undefined && shouldReplace(field) ? replacePrimitive(val, field) : val
  )

  return transform(values, refElement, transformReferences, false) || values
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
