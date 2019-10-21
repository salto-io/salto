import * as vscode from 'vscode'
import { InstanceElement, ElemID, ObjectType, Values, isPrimitiveType, PrimitiveTypes, Value } from 'adapter-api'
import { plan, Plan, apply, PlanItem } from 'salto'
import { EditorWorkspace } from './salto/workspace'
import { displayError, getBooleanInput, displayHTML, getStringInput, getNumberInput, hrefToUri } from './output'
import { getActionName, renderDiffView, createPlanDiff } from './format'

const displayPlan = async (
  planActions: Plan,
  extensionPath: string
): Promise<void> => vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: 'Creating apply plan',
},
async () => {
  const diff = await createPlanDiff(planActions.itemsByEvalOrder())
  const cssHrefs = [
    'diff2html.min.css',
    'main.css',
  ].map(href => hrefToUri(href, extensionPath).toString())
  return displayHTML(renderDiffView(diff, cssHrefs))
})

const shouldApply = async (planActions: Plan, extensionPath: string): Promise<boolean> => {
  await displayPlan(planActions, extensionPath)
  return getBooleanInput('Salto will apply the displayed changes', 'Approve', 'Cancel')
}

const getUserConfig = async (
  configType: ObjectType
): Promise<InstanceElement> => {
  const valuesGetters: {[key in PrimitiveTypes]: (msg: string) => Promise<Value>} = {
    [PrimitiveTypes.BOOLEAN]: (msg: string) => getBooleanInput(msg, 'Yes', 'No'),
    [PrimitiveTypes.STRING]: msg => getStringInput(msg),
    [PrimitiveTypes.NUMBER]: msg => getNumberInput(msg),
  }
  const values: Values = {}
  for (let i = 0; i < Object.values(configType.fields).length; i += 1) {
    const field = Object.values(configType.fields)[i]
    if (isPrimitiveType(field.type)) {
      const prompt = `Enter values for ${field.name}`
      /* eslint-disable-next-line no-await-in-loop */
      const input = await valuesGetters[field.type.primitive](prompt)
      if (!input) throw Error(`Did not provide input for ${field.name}`)
      values[field.name] = input
    }
  }
  return new InstanceElement(new ElemID('stam'), configType, values)
}

const updateProgress = async (
  progress: vscode.Progress<{message?: string; increament?: number}>,
  action: PlanItem
): Promise<void> => {
  const message = getActionName(action)
  progress.report({ message })
}

export const planCommand = async (
  workspace: EditorWorkspace,
  extensionPath: string
): Promise<void> => {
  if (!workspace.hasErrors()) {
    displayPlan(await plan(workspace.workspace), extensionPath)
  } else {
    displayError('Failed to run plan. Please fix the detected problems and try again.')
  }
}

export const applyCommand = async (
  workspace: EditorWorkspace,
  extensionPath: string
): Promise<void> => {
  const initApplyProgress = async (
    processPromise: Promise<Plan>,
  ): Promise<vscode.Progress<{message: string}>> => (
    new Promise<vscode.Progress<{message: string}>>(resolve => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Applying plan',
        cancellable: true,
      },
      progress => {
        resolve(progress)
        return processPromise
      })
    }))

  let progress: vscode.Progress<{message: string}>
  let applyProcess: Promise<Plan>
  const shouldApplyCB = async (p: Plan): Promise<boolean> => shouldApply(p, extensionPath)
  // A delayed initiation for the apply progress bar. We don't want to show it until
  // the actions start taking place (just running the apply in progress would cause
  // the progress to show before the user approved
  const updateActionCB = async (action: PlanItem): Promise<void> => {
    if (!progress) {
      progress = await initApplyProgress(applyProcess)
    }
    return updateProgress(progress, action)
  }

  if (workspace.hasErrors()) {
    displayError('Failed to run plan. Please fix the detected problems and try again.')
    return
  }

  try {
    applyProcess = apply(
      workspace.workspace,
      getUserConfig,
      shouldApplyCB,
      updateActionCB
    )
    await applyProcess
  } catch (e) {
    displayError(e.message)
  }
}
