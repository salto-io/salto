/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import { dumpElemID } from '@salto-io/core'
import { Element, isObjectType, isInstanceElement } from '@salto-io/adapter-api'
import { getLocations, SaltoElemLocation } from './location'
import { EditorWorkspace } from './workspace'

// TODO - Note that this will have no great performances until we will get the
// reverse SM from @salto-io/core's core. This is acceptable as this is not called so often
const getUsages = async (
  workspace: EditorWorkspace,
  element: Element,
  fullName: string
): Promise<SaltoElemLocation[]> => {
  if (isObjectType(element)) {
    const locs = await Promise.all(_(element.fields)
      .values()
      .filter(f => fullName === dumpElemID(f.type))
      .map(f => getLocations(workspace, f.elemID.getFullName()))
      .value())
    return _.flatten(locs)
  }
  if (isInstanceElement(element)) {
    const typeDumpName = dumpElemID(element.type)
    return (typeDumpName === fullName)
      ? getLocations(workspace, element.elemID.getFullName())
      : []
  }
  return []
}

export const provideWorkspaceReferences = async (
  workspace: EditorWorkspace,
  token: string
): Promise<SaltoElemLocation[]> => ([
  ..._.flatten(await Promise.all(
    (await workspace.workspace.elements).map(e => getUsages(workspace, e, token))
  )),
  ...await getLocations(workspace, token),
])
