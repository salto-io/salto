/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values } from '@salto-io/adapter-api'

export const getDiffIds = (
  beforeIds: string[] | undefined,
  afterIds: string[] | undefined,
): {
  addedIds: string[]
  removedIds: string[]
} => {
  const beforeIdsSet = new Set(beforeIds ?? [])
  const afterIdsSet = new Set(afterIds ?? [])

  return {
    addedIds: Array.from(afterIds ?? []).filter(id => !beforeIdsSet.has(id)),
    removedIds: Array.from(beforeIds ?? []).filter(id => !afterIdsSet.has(id)),
  }
}

export const getDiffObjects = (
  beforeObjects: Values[],
  afterObjects: Values[],
  idField: string,
): {
  addedObjects: Values[]
  modifiedObjects: Values[]
  removedObjects: Values[]
} => {
  const beforeIds = new Set(beforeObjects.map(obj => obj[idField]))
  const afterIds = new Set(afterObjects.map(obj => obj[idField]))

  return {
    addedObjects: afterObjects.filter(obj => !beforeIds.has(obj[idField])),
    removedObjects: beforeObjects.filter(obj => !afterIds.has(obj[idField])),
    modifiedObjects: afterObjects.filter(obj => beforeIds.has(obj[idField])),
  }
}
