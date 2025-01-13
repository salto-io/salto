/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ElemID, Element, ReadOnlyElementsSource, isElement } from '@salto-io/adapter-api'
import { ReferenceIndexEntry } from './reference_indexes'
import { ReadOnlyRemoteMap } from './remote_map'

const log = logger(module)
const { awu } = collections.asynciterable

const getDependentIDsFromReferenceSourceIndex = async (
  elemIDs: ElemID[],
  referenceSourcesIndex: ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
  elementsSource: ReadOnlyElementsSource,
): Promise<ElemID[]> =>
  log.timeDebug(
    async () => {
      const addedIDs = new Set<string>()

      const getDependentIDs = async (ids: ElemID[]): Promise<ElemID[]> => {
        ids.forEach(id => {
          addedIDs.add(id.getFullName())
        })

        const dependentIDs = await log.timeTrace(
          async () =>
            awu(ids)
              .map(id => referenceSourcesIndex.get(id.getFullName()))
              .flatMap(references => references ?? [])
              .map(ref => ref.id.createTopLevelParentID().parent)
              .filter(id => !addedIDs.has(id.getFullName()))
              .uniquify(id => id.getFullName())
              .toArray(),
          'getDependentIDs for %d ids',
          ids.length,
        )

        return dependentIDs.length === 0 ? dependentIDs : dependentIDs.concat(await getDependentIDs(dependentIDs))
      }

      const dependentIDs = await getDependentIDs(elemIDs)

      // if there are no dependent types we can return `dependentIDs` and avoid
      // iterating `elementsSource.list()` to get the additional dependent instances.
      if (!dependentIDs.some(id => id.idType === 'type')) {
        return dependentIDs
      }

      // in `referenceSourcesIndex` there are no references between types and their instances
      // so we should add the instances of the types that are in `addedIDs` as well.
      const additionalDependentInstanceIDs = await awu(await elementsSource.list())
        .filter(
          id =>
            id.idType === 'instance' &&
            !addedIDs.has(id.getFullName()) &&
            addedIDs.has(new ElemID(id.adapter, id.typeName).getFullName()),
        )
        .toArray()

      return dependentIDs.concat(additionalDependentInstanceIDs)
    },
    'getDependentIDsFromReferenceSourceIndex for %d elemIDs',
    elemIDs.length,
  )

const getDependentElements = (elementsSource: ReadOnlyElementsSource, dependentIDs: ElemID[]): Promise<Element[]> =>
  log.timeDebug(
    () => Promise.all(dependentIDs.map(id => elementsSource.get(id))).then(res => res.filter(isElement)),
    'getting %d dependents from elements source',
    dependentIDs.length,
  )

export const getDependents = async (
  elemIDs: ElemID[],
  elementsSource: ReadOnlyElementsSource,
  referenceSourcesIndex: ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
): Promise<Element[]> => {
  const dependentIDs = await getDependentIDsFromReferenceSourceIndex(elemIDs, referenceSourcesIndex, elementsSource)
  const dependents = await getDependentElements(elementsSource, dependentIDs)
  log.debug('found %d dependents of %d elements', dependents.length, elemIDs.length)
  if (dependentIDs.length !== dependents.length) {
    const missingDependents = _.difference(
      dependentIDs.map(id => id.getFullName()),
      dependents.map(elem => elem.elemID.getFullName()),
    )
    log.warn(
      `there is a mismatch between the num of requested dependent IDs and the num of dependents in the elements source. missing dependents: ${missingDependents}`,
    )
  }

  return dependents
}
