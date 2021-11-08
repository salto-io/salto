/*
*                      Copyright 2021 Salto Labs Ltd.
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
  InstanceElement, ObjectType, ElemID, getChangeElement, DetailedChange, Element,
  isInstanceElement, Values, Value, Field, isObjectType, isVariable, Variable,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { ElementsSource } from './elements_source'

const updateValue = (
  id: string[],
  values: Values,
  value: Value
): Values => {
  if (_.isEmpty(id) || !(id[0] in values)) {
    return values
  }
  return (id.length < 2)
    ? _.merge({}, values, { [id[0]]: value })
    : _.merge({}, values, { [id[0]]: updateValue(id.slice(1), values[id[0]], value) })
}

const getUpdatedField = (
  field: Field,
  change: DetailedChange
): Field => new Field(
  field.parent,
  field.name,
  field.refType,
  updateValue(change.id.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1),
    field.annotations, getChangeElement(change))
)

const getUpdatedObjectType = (
  topLevelElem: ObjectType,
  changes: DetailedChange[]
): ObjectType => {
  let { fields, annotations } = topLevelElem

  changes.filter(r => r.id.idType === 'field')
    .forEach(r => {
      const field = fields[r.id.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS)[0]]
      fields = _.merge({}, fields, { [field.name]: getUpdatedField(field, r) })
    })

  changes.filter(r => r.id.idType === 'annotation')
    .forEach(r => {
      annotations = updateValue(r.id.getFullNameParts()
        .slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS), annotations, getChangeElement(r))
    })

  return new ObjectType({
    ...topLevelElem,
    annotationRefsOrTypes: topLevelElem.annotationRefTypes,
    fields,
    annotations,
  })
}

const getUpdatedInstanceElement = (
  topLevelElem: InstanceElement,
  changes: DetailedChange[]
): InstanceElement => {
  let { value, annotations } = topLevelElem
  changes.forEach(r => {
    value = updateValue(r.id.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1),
      value, getChangeElement(r))
    annotations = updateValue(r.id.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1),
      annotations, getChangeElement(r))
  })

  return new InstanceElement(
    topLevelElem.elemID.getFullNameParts()[ElemID.NUM_ELEM_ID_NON_NAME_PARTS],
    topLevelElem.refType,
    value,
    topLevelElem.path,
    annotations
  )
}

const getUpdatedVariable = (
  topLevelElem: Variable,
  change: DetailedChange
): Variable => new Variable(
  topLevelElem.elemID,
  getChangeElement(change),
  topLevelElem.path
)

export const getUpdatedTopLevelElements = async (
  elementsSource: ElementsSource,
  changes: DetailedChange[]
): Promise<Element[]> => {
  const changesByTopLevelElemId = _.groupBy(
    changes, r => r.id.createTopLevelParentID().parent.getFullName()
  )

  return Promise.all(
    Object.entries(changesByTopLevelElemId).map(async ([e, changesInTopLevelElement]) => {
      const topLevelElem = await elementsSource.get(ElemID.fromFullName(e))
      if (isObjectType(topLevelElem)) {
        return getUpdatedObjectType(topLevelElem, changesInTopLevelElement)
      }
      if (isInstanceElement(topLevelElem)) {
        return getUpdatedInstanceElement(topLevelElem, changesInTopLevelElement)
      }
      if (isVariable(topLevelElem)) {
        return getUpdatedVariable(topLevelElem, changesInTopLevelElement.pop() as DetailedChange)
      }
      return topLevelElem
    })
  )
}
