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
  Element, ElemID, InstanceElement, ObjectType, ReferenceExpression, Field,
} from '@salto-io/adapter-api'
import {
  findInstances, naclCase,
} from '@salto-io/adapter-utils'
import { apiName } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import {
  addObjectParentReference, generateApiNameToCustomObject, id, allCustomObjectFields,
} from './utils'

export const LAYOUT_TYPE_ID = new ElemID(SALESFORCE, 'Layout')

const log = logger(module)

const MIN_NAME_LENGTH = 4

export const specialLayoutObjects = new Map([
  ['CaseClose', 'Case'],
  ['UserAlt', 'User'],
])

// Layout full name starts with related sobject and then '-'
const layoutObjAndName = (layout: InstanceElement): [string, string] => {
  const [obj, ...name] = apiName(layout).split('-')
  return [specialLayoutObjects.get(obj) ?? obj, name.join('-')]
}

const defaultLayoutName = (layout: InstanceElement): string => naclCase(apiName(layout))

const fixNames = (layouts: InstanceElement[]): void => {
  let names = layouts.map(id)

  const updateElemID = (layout: InstanceElement, newName: string): void => {
    if (newName.length < MIN_NAME_LENGTH) {
      return
    }
    const newId = layout.type.elemID.createNestedID('instance', naclCase(newName))
    if (!names.includes(newId.getFullName())) {
      names = _.without(names, id(layout))
      names.push(newId.getFullName())
      _.set(layout, 'elemID', newId)
    }
  }

  layouts
    .filter(layout => layout.elemID.name === defaultLayoutName(layout))
    .forEach(layout => updateElemID(layout, layoutObjAndName(layout)[1]))
}

const fixLayoutPath = (
  layout: InstanceElement,
  { path: objectPath }: ObjectType,
): void => {
  if (objectPath === undefined) {
    return
  }
  layout.path = [...objectPath.slice(0, -1), layout.elemID.typeName, layout.elemID.name]
}

type LayoutItem = {
  field: string | ReferenceExpression
}

type LayoutColumn = {
  layoutItems: LayoutItem[]
}

type LayoutSection = {
  layoutColumns: LayoutColumn[]
}

const fixLayoutItemField = (
  layoutItem: LayoutItem, layoutObj: ObjectType, layoutObjFields: Field[]
): void => {
  if (!layoutItem) return
  const findField = (fieldName: string, fields: Field[]): Field | undefined =>
    fields.find(field => field.elemID.name === fieldName)
  const reference = findField(layoutItem.field as string, layoutObjFields)
  if (!reference) {
    log.debug(`Could not find field ${layoutItem.field} for layout ${layoutObj.elemID.name}`)
    return
  }

  layoutItem.field = new ReferenceExpression(
    reference.elemID
  )
}

const fixLayoutColumnItems = (
  layout: InstanceElement,
  layoutObj: ObjectType,
  layoutObjFields: Field[]
): void => {
  const fixToArray = (obj: unknown): unknown => (_.isArray(obj) ? obj : [obj])

  const layoutItems = _(fixToArray(layout.value.layoutSections) as LayoutSection[])
    .map(layoutSection => fixToArray(layoutSection.layoutColumns) as LayoutColumn[])
    .flatten()
    .map(layoutColumn => fixToArray(layoutColumn.layoutItems as LayoutItem[]))
    .flatten()
  layoutItems.forEach(layoutItem => fixLayoutItemField(
    layoutItem as LayoutItem, layoutObj, layoutObjFields
  ))
}


/**
* Declare the layout filter, this filter adds reference from the sobject to it's layouts.
* Fixes references in layout items.
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, shorten layout ID and add reference to layout sobjects.
   * Fixes references in layout items.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const layouts = [...findInstances(elements, LAYOUT_TYPE_ID)]
    fixNames(layouts)

    const apiNameToCustomObject = generateApiNameToCustomObject(elements)

    layouts.forEach(layout => {
      const [layoutObjName, layoutName] = layoutObjAndName(layout)
      const layoutObj = apiNameToCustomObject.get(layoutObjName)
      if (layoutObj === undefined) {
        log.debug('Could not find object %s for layout %s', layoutObjName, layoutName)
        return
      }
      const layoutObjFields = [...allCustomObjectFields(elements, layoutObj?.elemID)]

      addObjectParentReference(layout, layoutObj)
      fixLayoutPath(layout, layoutObj)
      fixLayoutColumnItems(layout, layoutObj, layoutObjFields)
    })
  },
})

export default filterCreator
