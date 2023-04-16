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
import { logger } from '@salto-io/logging'
import {
  Element, InstanceElement, ObjectType, ElemID, isInstanceElement,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { multiIndex, collections } from '@salto-io/lowerdash'
import { apiName, isCustomObject } from '../transformers/transformer'
import { LocalFilterCreator } from '../filter'
import { addElementParentReference, isInstanceOfType, buildElementsSourceForFetch } from './utils'
import { SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE, WEBLINK_METADATA_TYPE } from '../constants'
import { getObjectDirectoryPath } from './custom_objects_to_object_type'

const { awu } = collections.asynciterable

const log = logger(module)

export const LAYOUT_TYPE_ID = new ElemID(SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE)
export const WEBLINK_TYPE_ID = new ElemID(SALESFORCE, WEBLINK_METADATA_TYPE)

export const specialLayoutObjects = new Map([
  ['CaseClose', 'Case'],
  ['UserAlt', 'User'],
])

// Layout full name starts with related sobject and then '-'
const layoutObjAndName = async (layout: InstanceElement): Promise<[string, string]> => {
  const [obj, ...name] = (await apiName(layout)).split('-')
  return [specialLayoutObjects.get(obj) ?? obj, name.join('-')]
}

const fixLayoutPath = async (
  layout: InstanceElement,
  customObject: ObjectType,
  layoutName: string,
): Promise<void> => {
  layout.path = [
    ...await getObjectDirectoryPath(customObject),
    layout.elemID.typeName,
    pathNaclCase(naclCase(layoutName)),
  ]
}

/**
* Declare the layout filter, this filter adds reference from the sobject to it's layouts.
* Fixes references in layout items.
*/
const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'layoutFilter',
  /**
   * Upon fetch, shorten layout ID and add reference to layout sobjects.
   * Fixes references in layout items.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const layouts = await awu(elements)
      .filter(isInstanceElement)
      .filter(isInstanceOfType(LAYOUT_TYPE_ID_METADATA_TYPE))
      .toArray()
    if (layouts.length === 0) {
      return
    }

    const referenceElements = buildElementsSourceForFetch(elements, config)
    const apiNameToCustomObject = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isCustomObject,
      key: async obj => [await apiName(obj)],
      map: obj => obj.elemID,
    })

    await awu(layouts).forEach(async layout => {
      const [layoutObjName, layoutName] = await layoutObjAndName(layout)
      const layoutObjId = apiNameToCustomObject.get(layoutObjName)
      const layoutObj = layoutObjId !== undefined
        ? await referenceElements.get(layoutObjId)
        : undefined
      if (layoutObj === undefined || !(await isCustomObject(layoutObj))) {
        log.debug('Could not find object %s for layout %s', layoutObjName, layoutName)
        return
      }

      addElementParentReference(layout, layoutObj)
      await fixLayoutPath(layout, layoutObj, layoutName)
    })
  },
})

export default filterCreator
