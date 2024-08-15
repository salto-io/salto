/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { DependencyChanger, getChangeData, AdapterOperations } from '@salto-io/adapter-api'

type AdapterDependencyChanger = (name: string, changer: DependencyChanger) => DependencyChanger
const adapterDependencyChanger: AdapterDependencyChanger = (name, changer) => (changes, deps) => {
  const filteredChanges = new Map(
    wu(changes.entries()).filter(([_id, change]) => getChangeData(change).elemID.adapter === name),
  )
  const filteredDeps = new Map(
    wu(deps.entries())
      .filter(([id]) => filteredChanges.has(id))
      .map(([id, idDeps]) => [id, new Set(wu(idDeps).filter(dep => filteredChanges.has(dep)))]),
  )
  return changer(filteredChanges, filteredDeps)
}

export const getAdapterDependencyChangers = (
  adapters: Record<string, AdapterOperations>,
): ReadonlyArray<DependencyChanger> =>
  _(adapters)
    .mapValues(({ deployModifiers }) => deployModifiers?.dependencyChanger)
    .pickBy(values.isDefined)
    .mapValues((changer, name) => adapterDependencyChanger(name, changer))
    .values()
    .value()
