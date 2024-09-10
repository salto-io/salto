/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DataNodeMap, DiffGraph, DiffGraphTransformer, DiffNode } from '@salto-io/dag'
import { Change, ChangeDataType, changeId, getChangeData } from '@salto-io/adapter-api'
import wu from 'wu'

export type PlanTransformer = DiffGraphTransformer<ChangeDataType>

export const buildGraphFromChanges = (changes: Iterable<Change>): DiffGraph<ChangeDataType> => {
  const graph = new DataNodeMap<DiffNode<ChangeDataType>>()
  wu(changes).forEach(change => {
    graph.addNode(
      changeId(change),
      [],
      Object.assign(change, { originalId: getChangeData(change).elemID.getFullName() }),
    )
  })
  return graph
}
