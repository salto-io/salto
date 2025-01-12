/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  getChangeData,
  Element,
  isRemovalChange,
  AuthorInformation,
  isAdditionOrModificationChange,
  getAuthorInformation,
  isModificationChange,
} from '@salto-io/adapter-api'
import { ElementsSource } from './elements_source'
import { getBaseChanges, updateIndex } from './index_utils'
import { RemoteMap } from './remote_map'

export const AUTHOR_INFORMATION_INDEX_VERSION = 1
const AUTHOR_INFORMATION_INDEX_KEY = 'author_information_index'

const updateChanges = async (changes: Change<Element>[], index: RemoteMap<AuthorInformation>): Promise<void> => {
  const allChanges = getBaseChanges(changes)

  const entries = allChanges
    .filter(isAdditionOrModificationChange)
    .map(change => ({
      key: change.data.after.elemID.getFullName(),
      before: getAuthorInformation(isModificationChange(change) ? change.data.before : undefined),
      after: getAuthorInformation(change.data.after),
    }))
    .filter(({ before, after }) => !_.isEqual(before, after))
    .map(({ key, after }) => ({ key, value: after }))

  const [entriesToSet, entriesWithEmptyValue] = _.partition(entries, ({ value }) => !_.isEmpty(value))

  const keysToDelete = allChanges
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(elem => elem.elemID.getFullName())
    .concat(entriesWithEmptyValue.map(e => e.key))

  await index.setAll(entriesToSet)
  await index.deleteAll(keysToDelete)
}

export const updateAuthorInformationIndex = async (
  changes: Change<Element>[],
  authorInformationIndex: RemoteMap<AuthorInformation>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
): Promise<void> =>
  updateIndex({
    changes,
    index: authorInformationIndex,
    indexVersionKey: AUTHOR_INFORMATION_INDEX_KEY,
    indexVersion: AUTHOR_INFORMATION_INDEX_VERSION,
    indexName: 'author information',
    mapVersions,
    elementsSource,
    isCacheValid,
    updateChanges,
  })
