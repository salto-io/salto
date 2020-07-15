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
import { copy as copyToClipboard } from 'copy-paste'
import { context, workspace as ws } from '@salto-io/lang-server'
import { vsPosToSaltoPos } from './adapters'

export const createCopyReferenceCommand = (
  workspace: ws.EditorWorkspace
): (
) => Promise<void> => async () => {
  const editor = vscode.window.activeTextEditor
  if (_.isUndefined(editor)) {
    return
  }
  const position = editor.selection.active
  await workspace.awaitAllUpdates()
  const saltoPos = vsPosToSaltoPos(position)
  const ctx = await context.getPositionContext(
    workspace,
    editor.document.fileName,
    saltoPos
  )
  const copyText = ctx.ref?.element.elemID.createNestedID(...ctx.ref.path).getFullName()
  copyToClipboard(copyText)
}
