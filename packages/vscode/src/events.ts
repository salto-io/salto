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
import * as path from 'path'
import { file } from '@salto-io/core'
import { EditorWorkspace } from './salto/workspace'
import { getDiagnostics } from './salto/diagnostics'
import { toVSDiagnostics } from './adapters'

export const onReportErrorsEvent = async (
  _event: vscode.TextDocumentChangeEvent,
  workspace: EditorWorkspace,
  diagCollection: vscode.DiagnosticCollection
): Promise<void> => {
  await workspace.awaitAllUpdates()
  const newDiag = toVSDiagnostics(
    workspace.config.baseDir,
    await getDiagnostics(workspace)
  )
  diagCollection.set(newDiag)
}

// This function is called whenever a file content is changed. The function will
// reparse the file that changed.
export const onTextChangeEvent = (
  event: vscode.TextDocumentChangeEvent,
  workspace: EditorWorkspace
): void => {
  if (path.extname(event.document.fileName) === '.bp') {
    const bp = { filename: event.document.fileName, buffer: event.document.getText() }
    workspace.setBlueprints(bp)
  }
}

export const onFileOpen = (): void => {
  vscode.commands.executeCommand('editor.foldAllMarkerRegions')
}

export const onFileDelete = (
  workspace: EditorWorkspace,
  filename: string
): Promise<void> => {
  workspace.removeBlueprints(filename)
  return workspace.awaitAllUpdates()
}

export const onFileChange = async (
  workspace: EditorWorkspace,
  filename: string
): Promise<void> => {
  const buffer = await file.readTextFile(filename)
  workspace.setBlueprints({ filename, buffer })
  return workspace.awaitAllUpdates()
}
