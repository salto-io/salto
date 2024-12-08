/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { addElementParentReference, apiNameSync, buildElementsSourceForFetch, metadataTypeSync } from './utils'

const { isDefined } = lowerDashValues
const { toArrayAsync } = collections.asynciterable
const { DefaultMap } = collections.map

type FolderInstancesIndex = Map<string, Record<string, InstanceElement>>

const isWithinFolder = (instance: InstanceElement): boolean => isDefined(instance.getTypeSync().annotations.folderType)

const createFolderInstancesIndex = (elements: Element[]): FolderInstancesIndex => {
  const folderInstancesIndex = new DefaultMap<string, Record<string, InstanceElement>>(() => ({}))
  elements.filter(isInstanceElement).forEach(folderInstance => {
    if (folderInstance.getTypeSync().annotations.folderContentType) {
      folderInstancesIndex.get(metadataTypeSync(folderInstance))[apiNameSync(folderInstance) ?? ''] = folderInstance
    }
  })
  return folderInstancesIndex
}

const filter: FilterCreator = ({ config }) => ({
  name: 'addParentToMetadataInstancesWithinFolder',
  onFetch: async (elements: Element[]) => {
    const folderInstancesIndex = createFolderInstancesIndex(
      await toArrayAsync(await buildElementsSourceForFetch(elements, config).getAll()),
    )
    const getFolderInstance = (instance: InstanceElement): InstanceElement | undefined => {
      const { folderType } = instance.getTypeSync().annotations
      const folderName = apiNameSync(instance)?.split('/')[0] ?? ''
      return folderInstancesIndex.get(folderType)?.[folderName]
    }
    elements
      .filter(isInstanceElement)
      .filter(isWithinFolder)
      .forEach(instance => {
        const parent = getFolderInstance(instance)
        if (isDefined(parent)) {
          addElementParentReference(instance, parent)
        }
      })
  },
})

export default filter
