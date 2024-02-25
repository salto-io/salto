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
import { ElemID } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { InMemoryRemoteMap } from './workspace/remote_map'
import { Workspace } from './workspace/workspace'
import { PathIndex, Path, updatePathIndex } from './workspace/path_index'

const { awu } = collections.asynciterable

// this function can be removed when we do the fragment refactor (SALTO-2217)
export const createPathIndexForElement = async (workspace: Workspace, id: ElemID): Promise<PathIndex> => {
  const { parent } = id.createTopLevelParentID()
  const elementNaclFiles = await workspace.getElementNaclFiles(parent)
  const naclFragments = await awu(elementNaclFiles)
    .map(workspace.getParsedNaclFile)
    .flatMap(async parsedFile => (await parsedFile?.elements()) ?? [])
    .filter(elem => elem.elemID.isEqual(parent))
    .toArray()
  const naclPathIndex = new InMemoryRemoteMap<Path[]>()
  await updatePathIndex({
    pathIndex: naclPathIndex,
    unmergedElements: naclFragments,
  })
  return naclPathIndex
}
