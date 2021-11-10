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
  isInstanceElement, isObjectType, isVariable, Variable, Value, ElemIDType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { ElementsSource } from './elements_source'
import { Path } from './path_index'

const getUpdatedObjectType = (
  topLevelElem: ObjectType,
  values: { idType: ElemIDType; path: Path; value: Value }[]
): ObjectType => {
  const { fields, annotations } = topLevelElem

  values.filter(v => v.idType === 'field')
    .forEach(v => {
      // the path of values in Field are without 'annotations' attribute so it needs to be added:
      // field.key -> field.annotations.key
      const path = _.concat(_.head(v.path), 'annotations', ..._.tail(v.path)) as Path
      _.set(fields, path, v.value)
    })

  values.filter(v => v.idType === 'annotation')
    .forEach(v => {
      _.set(annotations, v.path, v.value)
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
  values: { path: Path; value: Value }[]
): InstanceElement => {
  const { value, annotations } = topLevelElem
  values.forEach(v => {
    if (_.get(value, v.path)) {
      _.set(value, v.path, v.value)
    }
    if (_.get(annotations, v.path)) {
      _.set(annotations, v.path, v.value)
    }
  })

  return new InstanceElement(
    topLevelElem.elemID.name,
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
        const values = changesInTopLevelElement.map(c => ({
          idType: c.id.idType,
          path: c.id.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS),
          value: getChangeElement(c),
        }))
        return getUpdatedObjectType(topLevelElem, values)
      }
      if (isInstanceElement(topLevelElem)) {
        const values = changesInTopLevelElement.map(c => ({
          path: c.id.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1),
          value: getChangeElement(c),
        }))
        return getUpdatedInstanceElement(topLevelElem, values)
      }
      if (isVariable(topLevelElem)) {
        return getUpdatedVariable(topLevelElem, changesInTopLevelElement.pop() as DetailedChange)
      }
      return topLevelElem
    })
  )
}
