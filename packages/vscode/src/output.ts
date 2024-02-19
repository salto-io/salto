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
import * as path from 'path'

let currentPanel: vscode.WebviewPanel | undefined
const ICON_PATH = path.join('icons', 'images', 'file_type_salto_blue.png')
export type HTML = string

export const hrefToUri = (href: string, extensionPath: string): vscode.Uri =>
  vscode.Uri.file(path.join(extensionPath, 'css', href)).with({ scheme: 'vscode-resource' })

export const displayHTML = (html: string, extensionPath: string): void => {
  if (!currentPanel) {
    currentPanel = vscode.window.createWebviewPanel('Salto', 'Salto', vscode.ViewColumn.One)
    currentPanel.iconPath = vscode.Uri.file(path.join(extensionPath, ICON_PATH))
    currentPanel.onDidDispose(() => {
      currentPanel = undefined
    })
  }
  currentPanel.webview.html = html
  currentPanel.reveal()
}

export const displayError = (errMsg: string): void => {
  // We really do *not* want to await on this.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.window.showErrorMessage(errMsg)
}

export const getBooleanInput = async (msg: string, yesText: string, noText: string): Promise<boolean> =>
  (await vscode.window.showInformationMessage(msg, yesText, noText)) === yesText

export const getStringInput = async (msg: string): Promise<string | undefined> =>
  vscode.window.showInputBox({ prompt: msg })

export const getNumberInput = async (msg: string): Promise<number | undefined> => {
  const res = await vscode.window.showInputBox({ prompt: msg })
  return res ? Number.parseInt(res, 10) : undefined
}

export const handleErrors = (msgErrs: string[]): void => {
  const outputChannel = vscode.window.createOutputChannel('salto')
  outputChannel.clear()
  if (msgErrs) {
    msgErrs.forEach(msgErr => outputChannel.appendLine(msgErr))
    outputChannel.show()
    // We really do *not* want to await on this.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showErrorMessage('Deploy Failed', 'OK')
  }
}
