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
import { logger } from '@salto-io/logging'
import {
  Element, InstanceElement, ObjectType, ElemID,
} from '@salto-io/adapter-api'
import {
  findInstances, naclCase, pathNaclCase,
} from '@salto-io/adapter-utils'
import { apiName } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import {
  addObjectParentReference, generateApiNameToCustomObject,
} from './utils'
import { SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE, WEBLINK_METADATA_TYPE } from '../constants'

const log = logger(module)

export const LAYOUT_TYPE_ID = new ElemID(SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE)
export const WEBLINK_TYPE_ID = new ElemID(SALESFORCE, WEBLINK_METADATA_TYPE)

export const specialLayoutObjects = new Map([
  ['CaseClose', 'Case'],
  ['UserAlt', 'User'],
])

// Layout full name starts with related sobject and then '-'
const layoutObjAndName = (layout: InstanceElement): [string, string] => {
  const [obj, ...name] = apiName(layout).split('-')
  return [specialLayoutObjects.get(obj) ?? obj, name.join('-')]
}

const fixLayoutPath = (
  layout: InstanceElement,
  { path: objectPath }: ObjectType,
  layoutName: string,
): void => {
  if (objectPath === undefined) {
    return
  }
  layout.path = [
    ...objectPath.slice(0, -1),
    layout.elemID.typeName,
    pathNaclCase(naclCase(layoutName)),
  ]
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
    const apiNameToCustomObject = generateApiNameToCustomObject(elements)

    layouts.forEach(layout => {
      const [layoutObjName, layoutName] = layoutObjAndName(layout)
      const layoutObj = apiNameToCustomObject.get(layoutObjName)
      if (layoutObj === undefined) {
        log.debug('Could not find object %s for layout %s', layoutObjName, layoutName)
        return
      }

      addObjectParentReference(layout, layoutObj)
      fixLayoutPath(layout, layoutObj, layoutName)
    })
  },
})

export default filterCreator
