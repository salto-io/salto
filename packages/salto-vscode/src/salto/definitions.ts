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
import { isObjectType, isInstanceElement, getField } from 'adapter-api'
import { parseElemID } from 'salto'
import { EditorWorkspace } from './workspace'
import { PositionContext } from './context'
import { getLocations, SaltoElemLocation } from './location'

export const provideWorkspaceDefinition = async (
  workspace: EditorWorkspace,
  context: PositionContext,
  token: string
): Promise<SaltoElemLocation[]> => {
  if (context.ref && isInstanceElement(context.ref.element)) {
    const refPath = context.ref.path.replace(new RegExp(`${token}$`), '')
    const refType = (refPath)
      ? getField(context.ref.element.type, refPath.split(' '))
      : context.ref.element.type
    // If we are inside an instance obj, we look for the *field* definitions by
    // field name
    if (isObjectType(refType)) {
      const refField = refType.fields[token]
      const fullName = (refField) ? refField.elemID.getFullName() : refType.elemID.getFullName()
      return getLocations(workspace, fullName)
    }
  }
  // We are not in instance, so we can just look the current token
  return getLocations(workspace, parseElemID(token).getFullName())
}
