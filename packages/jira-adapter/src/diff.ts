/*
 *                      Copyright 2024 Salto Labs Ltd.
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
