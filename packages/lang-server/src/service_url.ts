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
import { CORE_ANNOTATIONS, ElemID, isElement, isField } from '@salto-io/adapter-api'
import { PositionContext } from './context'
import { EditorWorkspace } from './workspace'

const getElementIDUrl = async (workspace: EditorWorkspace, elemID: ElemID): Promise<URL | undefined> => {
  const element = await workspace.getValue(elemID)

  if (!isElement(element)) {
    return undefined
  }

  const url = element.annotations[CORE_ANNOTATIONS.SERVICE_URL]
  if (url === undefined) {
    return undefined
  }
  return new URL(url)
}

export const getServiceUrl = async (workspace: EditorWorkspace, context: PositionContext): Promise<URL | undefined> => {
  if (context.ref === undefined) {
    return undefined
  }
  const { element } = context.ref

  if (isField(element)) {
    const url = await getElementIDUrl(workspace, element.elemID)
    if (url !== undefined) {
      return url
    }
  }

  return getElementIDUrl(workspace, element.elemID.createTopLevelParentID().parent)
}
