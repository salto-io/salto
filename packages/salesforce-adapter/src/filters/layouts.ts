/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { Element, InstanceElement, ObjectType, ElemID } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { multiIndex, collections } from '@salto-io/lowerdash'
import { apiName } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import {
  addElementParentReference,
  buildElementsSourceForFetch,
  layoutObjAndName,
  isInstanceOfTypeSync,
  isCustomObjectOrCustomMetadataRecordTypeSync,
} from './utils'
import { SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE } from '../constants'
import { getObjectDirectoryPath } from './custom_objects_to_object_type'

const { awu } = collections.asynciterable

const log = logger(module)

export const LAYOUT_TYPE_ID = new ElemID(SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE)

const fixLayoutPath = async (layout: InstanceElement, customObject: ObjectType, layoutName: string): Promise<void> => {
  layout.path = [
    ...(await getObjectDirectoryPath(customObject)),
    layout.elemID.typeName,
    pathNaclCase(naclCase(layoutName)),
  ]
}

/**
 * Declare the layout filter, this filter adds reference from the sobject to it's layouts.
 * Fixes references in layout items.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'layoutFilter',
  /**
   * Upon fetch, shorten layout ID and add reference to layout sobjects.
   * Fixes references in layout items.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const layouts = elements.filter(isInstanceOfTypeSync(LAYOUT_TYPE_ID_METADATA_TYPE))
    if (layouts.length === 0) {
      return
    }

    const referenceElements = buildElementsSourceForFetch(elements, config)
    const apiNameToCustomObject = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isCustomObjectOrCustomMetadataRecordTypeSync,
      key: async obj => [await apiName(obj)],
      map: obj => obj.elemID,
    })

    await awu(layouts).forEach(async layout => {
      const [layoutObjName, layoutName] = layoutObjAndName(await apiName(layout))
      const layoutObjId = apiNameToCustomObject.get(layoutObjName)
      const layoutObj = layoutObjId !== undefined ? await referenceElements.get(layoutObjId) : undefined
      if (layoutObj === undefined || !isCustomObjectOrCustomMetadataRecordTypeSync(layoutObj)) {
        log.debug('Could not find object %s for layout %s', layoutObjName, layoutName)
        return
      }

      addElementParentReference(layout, layoutObj)
      await fixLayoutPath(layout, layoutObj, layoutName)
    })
  },
})

export default filterCreator
