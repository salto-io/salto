/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getChangeData, Element, isAdditionOrModificationChange, isRemovalChange } from '@salto-io/adapter-api'
import _, { isEmpty } from 'lodash'
import { ElementsSource } from './elements_source'
import { updateIndex } from './index_utils'
import { getNestedStaticFiles } from './nacl_files'
import { RemoteMap } from './remote_map'

export const STATIC_FILES_INDEX_VERSION = 1
const STATIC_FILES_INDEX_KEY = 'static_files_index'

const updateChanges = async (changes: Change<Element>[], index: RemoteMap<string[]>): Promise<void> => {
  const staticFilesMap = Object.fromEntries(
    changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .map(element => [
        element.elemID.getFullName(),
        getNestedStaticFiles(element).map(staticFile => staticFile.filepath),
      ]),
  )
  const [toBeRemoved, toBeSet] = _.partition(Object.keys(staticFilesMap), key => isEmpty(staticFilesMap[key]))
  const removedElementIds = changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(element => element.elemID.getFullName())
  await index.setAll(toBeSet.map(key => ({ key, value: staticFilesMap[key] })))
  await index.deleteAll(toBeRemoved.concat(removedElementIds))
}

export const updateReferencedStaticFilesIndex = async (
  changes: Change<Element>[],
  staticFilesIndex: RemoteMap<string[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
): Promise<void> =>
  updateIndex({
    changes,
    index: staticFilesIndex,
    indexVersionKey: STATIC_FILES_INDEX_KEY,
    indexVersion: STATIC_FILES_INDEX_VERSION,
    indexName: 'static files',
    mapVersions,
    elementsSource,
    isCacheValid,
    updateChanges,
  })
