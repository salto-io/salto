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
import { isInstanceElement, getField } from '@salto-io/adapter-api'
import _ from 'lodash'
import { EditorWorkspace } from './workspace'
import { PositionContext } from './context'
import { getLocations, SaltoElemLocation } from './location'

export const provideWorkspaceDefinition = async (
  workspace: EditorWorkspace,
  context: PositionContext,
  token: string
): Promise<SaltoElemLocation[]> => {
  if (context.ref && isInstanceElement(context.ref.element)) {
    const refPath = context.ref.path
    if (!_.isEmpty(refPath) && _.last(refPath) === token) {
      const field = getField(context.ref.element.type, refPath)?.field
      return field ? getLocations(workspace, field.elemID.getFullName()) : []
    }
  }
  // We are not in instance field, so we can just look the current token
  try {
    return getLocations(workspace, token)
  } catch (e) {
    return []
  }
}
