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
import * as vscode from 'vscode'
import _ from 'lodash'
import { ElemID } from '@salto-io/adapter-api'
import { copy as copyToClipboard } from 'copy-paste'
import { getPositionContext } from './salto/context'
import { EditorWorkspace } from './salto/workspace'
import { vsPosToSaltoPos } from './adapters'

export const createCopyReferenceCommand = (
  workspace: EditorWorkspace
): (
) => Promise<void> => async () => {
  const editor = vscode.window.activeTextEditor
  if (_.isUndefined(editor)) {
    return
  }
  const position = editor.selection.active
  await workspace.awaitAllUpdates()
  const validWorkspace = await workspace.getValidCopy()
  if (!validWorkspace) {
    return
  }
  const saltoPos = vsPosToSaltoPos(position)
  const ctx = await getPositionContext(
    validWorkspace,
    editor.document.fileName,
    saltoPos
  )
  const copyText = _.isEmpty(ctx.ref?.path)
    ? ctx.ref?.element.elemID.getFullName()
    : [ctx.ref?.element.elemID.getFullName(), ctx.ref?.path].join(ElemID.NAMESPACE_SEPARATOR)
  copyToClipboard(copyText)
}
