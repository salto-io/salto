import * as vscode from 'vscode'

let currentPanel: vscode.WebviewPanel | undefined

export type HTML = string

export const displayHTML = (html: string): void => {
  if (!currentPanel) {
    currentPanel = vscode.window.createWebviewPanel(
      'Salto',
      'Salto',
      vscode.ViewColumn.One
    )
    currentPanel.onDidDispose(() => currentPanel = undefined )
  }
  currentPanel.webview.html = html
}

export const displayError = (errMsg: string): void => {
  vscode.window.showErrorMessage(errMsg)
}

export const getBooleanInput = async (msg: string, yesText: string, noText: string): Promise<boolean> => {
  return await vscode.window.showInformationMessage(msg,yesText,noText) === yesText
}

export const getStringInput = async (msg: string): Promise<string|undefined> => {
  return await vscode.window.showInputBox({prompt: msg})
}

export const getNumberInput = async (msg: string): Promise<number|undefined> => {
  const res = await vscode.window.showInputBox({prompt: msg})
  return res ? Number.parseInt(res) : undefined
}
