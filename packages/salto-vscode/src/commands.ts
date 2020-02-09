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
import { SaltoError } from 'adapter-api'
import { preview, Plan, deploy, ItemStatus, PlanItem, DeployResult, WorkspaceError } from 'salto'
import wu from 'wu'
import { EditorWorkspace } from './salto/workspace'
import { displayError, getBooleanInput, displayHTML, hrefToUri, handleErrors } from './output'
import { getActionName, renderDiffView, createPlanDiff } from './format'

const displayPlan = async (
  planActions: Plan,
  extensionPath: string
): Promise<void> => vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: 'Creating deploy plan',
},
async () => {
  const diff = await createPlanDiff(planActions.itemsByEvalOrder())
  const cssHrefs = [
    'diff2html.min.css',
    'main.css',
  ].map(href => hrefToUri(href, extensionPath).toString())
  return displayHTML(renderDiffView(diff, cssHrefs), extensionPath)
})

const shouldDeploy = async (planActions: Plan, extensionPath: string): Promise<boolean> => {
  await displayPlan(planActions, extensionPath)
  return getBooleanInput('Salto will deploy the displayed changes', 'Approve', 'Cancel')
}

const updateProgress = async (
  progress: vscode.Progress<{message?: string; increament?: number}>,
  action: PlanItem
): Promise<void> => {
  const message = getActionName(action)
  progress.report({ message })
}

const getCriticalErrors = async (
  workspace: EditorWorkspace
): Promise<ReadonlyArray<WorkspaceError<SaltoError>>> => (
  (await workspace.workspace.getWorkspaceErrors()).filter(e => e.severity === 'Error')
)

const hasCriticalErrors = async (workspace: EditorWorkspace): Promise<boolean> => (
  (await getCriticalErrors(workspace)).length > 0
)

export const previewCommand = async (
  workspace: EditorWorkspace,
  extensionPath: string
): Promise<void> => {
  if (!(await hasCriticalErrors(workspace))) {
    displayPlan(await preview(workspace.workspace), extensionPath)
  } else {
    displayError('Failed to create a preview. Please fix the detected problems and try again.')
  }
}

export const deployCommand = async (
  workspace: EditorWorkspace,
  extensionPath: string
): Promise<void> => {
  const initDeployProgress = async (
    processPromise: Promise<DeployResult>,
  ): Promise<vscode.Progress<{message: string}>> => (
    new Promise<vscode.Progress<{message: string}>>(resolve => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Deploying changes',
        cancellable: true,
      },
      progress => {
        resolve(progress)
        return processPromise
      })
    }))

  let progress: vscode.Progress<{message: string}>
  let deployProcess: Promise<DeployResult>
  const shouldDeployCB = async (p: Plan): Promise<boolean> => shouldDeploy(p, extensionPath)
  // A delayed initiation for the deploy progress bar. We don't want to show it until
  // the actions start taking place (just running the deploy in progress would cause
  // the progress to show before the user approved
  const updateActionCB = async (action: PlanItem, status: ItemStatus): Promise<void> => {
    if (status === 'started') {
      if (!progress) {
        progress = await initDeployProgress(deployProcess)
      }
      return updateProgress(progress, action)
    }
    return Promise.resolve()
  }

  if (await hasCriticalErrors(workspace)) {
    displayError('Failed to run plan. Please fix the detected problems and try again.')
    return
  }

  try {
    deployProcess = deploy(
      workspace.workspace,
      shouldDeployCB,
      updateActionCB
    )
    const result = await deployProcess
    handleErrors(result.errors.map(e => e.message))
    await workspace.updateBlueprints(...wu(result.changes || []).map(c => c.change).toArray())
    if (await hasCriticalErrors(workspace)) {
      (await getCriticalErrors(workspace)).forEach(e => displayError(e.message))
    }
  } catch (e) {
    displayError(e.message)
  }
}
