import * as vscode from 'vscode'
import * as path from 'path'

let currentPanel: vscode.WebviewPanel | undefined
const ICON_PATH = path.join('icons', 'images', 'file_type_salto_blue.png')
export type HTML = string

export const hrefToUri = (href: string, extensionPath: string): vscode.Uri => (
  vscode.Uri.file(path.join(extensionPath, 'css', href)).with({ scheme: 'vscode-resource' })
)

export const displayHTML = (html: string, extensionPath: string): void => {
  if (!currentPanel) {
    currentPanel = vscode.window.createWebviewPanel(
      'Salto',
      'Salto',
      vscode.ViewColumn.One
    )
    currentPanel.iconPath = vscode.Uri.file(path.join(extensionPath, ICON_PATH))
    currentPanel.onDidDispose(() => {
      currentPanel = undefined
    })
  }
  currentPanel.webview.html = html
  currentPanel.reveal()
}

export const displayError = (errMsg: string): void => {
  vscode.window.showErrorMessage(errMsg)
}

export const getBooleanInput = async (
  msg: string,
  yesText: string,
  noText: string
): Promise<boolean> => await vscode.window.showInformationMessage(msg, yesText, noText) === yesText

export const getStringInput = async (
  msg: string
): Promise<string|undefined> => vscode.window.showInputBox({ prompt: msg })

export const getNumberInput = async (msg: string): Promise<number|undefined> => {
  const res = await vscode.window.showInputBox({ prompt: msg })
  return res ? Number.parseInt(res, 10) : undefined
}
