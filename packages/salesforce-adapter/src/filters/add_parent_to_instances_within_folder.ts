/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { addElementParentReference, apiNameSync, buildElementsSourceForFetch, metadataTypeSync } from './utils'

const { isDefined } = lowerDashValues
const { toArrayAsync } = collections.asynciterable
const { DefaultMap } = collections.map
const log = logger(module)

type FolderInstancesIndex = Map<string, Record<string, InstanceElement>>

const getFolderInstance = (
  instance: InstanceElement,
  folderInstancesIndex: FolderInstancesIndex,
): InstanceElement | undefined => {
  const { folderType } = instance.getTypeSync().annotations
  const folderName = apiNameSync(instance)?.split('/')[0] ?? ''
  return folderInstancesIndex.get(folderType)?.[folderName]
}

const isInstanceWithinFolder = (instance: InstanceElement): boolean =>
  isDefined(instance.getTypeSync().annotations.folderType)

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
  name: 'addParentToInstancesWithinFolderFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetchProfile.isFeatureEnabled('addParentToInstancesWithinFolder')) {
      return
    }
    const folderInstancesIndex = createFolderInstancesIndex(
      await toArrayAsync(await buildElementsSourceForFetch(elements, config).getAll()),
    )
    const count: number = elements
      .filter(isInstanceElement)
      .filter(isInstanceWithinFolder)
      .reduce((acc, instance) => {
        const parent = getFolderInstance(instance, folderInstancesIndex)
        if (isDefined(parent)) {
          addElementParentReference(instance, parent)
          return acc + 1
        }
        return acc
      }, 0)
    log.debug('addParentToInstancesWithinFolderFilter created %d references in total', count)
  },
})

export default filter
