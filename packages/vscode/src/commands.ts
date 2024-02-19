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
import * as vscode from 'vscode'
import _ from 'lodash'
import open from 'open'

import clipboard from 'clipboardy'
import { context, serviceUrl, workspace as ws } from '@salto-io/lang-server'
import { collections } from '@salto-io/lowerdash'
import { vsPosToSaltoPos } from './adapters'

const { awu } = collections.asynciterable
const copyToClipboard = clipboard.writeSync

export const createCopyReferenceCommand =
  (workspace: ws.EditorWorkspace): (() => Promise<void>) =>
  async () => {
    const editor = vscode.window.activeTextEditor
    if (_.isUndefined(editor)) {
      return
    }
    const definitionsTree = context.buildDefinitionsTree(
      (await workspace.getNaclFile(editor.document.fileName))?.buffer as string,
      await workspace.getSourceMap(editor.document.fileName),
      await awu(await workspace.getElements(editor.document.fileName)).toArray(),
    )
    const fullElementSource = await workspace.getElementSourceOfPath(editor.document.fileName)
    const position = editor.selection.active
    await workspace.awaitAllUpdates()
    const saltoPos = vsPosToSaltoPos(position)
    const ctx = await context.getPositionContext(editor.document.fileName, saltoPos, definitionsTree, fullElementSource)
    if (ctx.ref) {
      const copyText =
        ctx.ref.path.length > 0
          ? ctx.ref.element.elemID.createNestedID(...ctx.ref.path).getFullName()
          : ctx.ref.element.elemID.getFullName()
      copyToClipboard(copyText)
    }
  }

const getServiceUrl = async (workspace: ws.EditorWorkspace): Promise<URL | undefined> => {
  const editor = vscode.window.activeTextEditor
  if (editor === undefined) {
    return undefined
  }

  const position = editor.selection.active
  await workspace.awaitAllUpdates()
  const saltoPos = vsPosToSaltoPos(position)
  const definitionsTree = context.buildDefinitionsTree(
    (await workspace.getNaclFile(editor.document.fileName))?.buffer as string,
    await workspace.getSourceMap(editor.document.fileName),
    await awu(await workspace.getElements(editor.document.fileName)).toArray(),
  )
  const fullElementSource = await workspace.getElementSourceOfPath(editor.document.fileName)
  const ctx = await context.getPositionContext(editor.document.fileName, saltoPos, definitionsTree, fullElementSource)

  return serviceUrl.getServiceUrl(workspace, ctx)
}

export const createGoToServiceCommand =
  (workspace: ws.EditorWorkspace): (() => Promise<void>) =>
  async () => {
    const url = await getServiceUrl(workspace)
    if (url === undefined) {
      await vscode.window.showErrorMessage('Go to service is not supported for the chosen element')
      return
    }
    // Using this library instead of vscode.env.openExternal because of issue: https://github.com/microsoft/vscode/issues/112577
    await open(url.href)
  }
