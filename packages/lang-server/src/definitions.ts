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
import { isInstanceElement, getField } from '@salto-io/adapter-api'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { EditorWorkspace } from './workspace'
import { PositionContext } from './context'
import { getLocations, SaltoElemLocation, getStaticLocations } from './location'
import { Token } from './token'

const CONTAINER_PATTERN = /<([\w.]+)>/

export const provideWorkspaceDefinition = async (
  workspace: EditorWorkspace,
  context: PositionContext,
  token: Token,
): Promise<SaltoElemLocation[]> => {
  if (context.ref) {
    const staticFileLocation = await getStaticLocations(workspace, context.ref.element, context.ref.path, token)
    if (values.isDefined<SaltoElemLocation>(staticFileLocation)) {
      return [staticFileLocation]
    }
  }

  try {
    const match = CONTAINER_PATTERN.exec(token.value)
    const idToken = match !== null ? match[1] : token.value

    const locations = await getLocations(workspace, idToken)
    if (locations.length !== 0) {
      return locations
    }
    // eslint-disable-next-line no-empty
  } catch (e) {
    // token is not a valid element id
  }

  if (context.ref) {
    if (isInstanceElement(context.ref.element)) {
      const refPath = context.ref.path
      if (!_.isEmpty(refPath) && _.last(refPath) === token.value) {
        const field = await getField(
          await context.ref.element.getType(await workspace.elements),
          refPath,
          await workspace.elements,
        )
        return field ? getLocations(workspace, field.elemID.getFullName()) : []
      }
    }
    if (context.type === 'type') {
      return getLocations(
        workspace,
        context.ref?.element.elemID.createNestedID('annotation', token.value).getFullName(),
      )
    }
  }

  return []
}
