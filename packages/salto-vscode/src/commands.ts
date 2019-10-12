import wu from 'wu'
import { Diff2Html } from 'diff2html'
import * as vscode from 'vscode'
import * as path from 'path'
import { InstanceElement, ElemID, ObjectType, Values, isPrimitiveType, PrimitiveTypes, Value } from 'adapter-api'
import { plan, Plan, apply, PlanItem } from 'salto'
import { EditorWorkspace } from './salto/workspace'
import { displayError, getBooleanInput, displayHTML, HTML, getStringInput, getNumberInput } from './output'
import { UnifiedDiff, getActionName, createChangeDiff } from './format'


const renderDiffView = (diff: UnifiedDiff, extensionPath: string): HTML => {
  const htmlDiff = Diff2Html.getPrettyHtml(diff, { inputFormat: 'diff' })
  const cssHrefs = [
    'diff2html.min.css',
    'main.css',
  ].map(
    name => vscode.Uri.file(path.join(extensionPath, 'css', name)).with({ scheme: 'vscode-resource' })
  )
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${cssHrefs.map(href => `<link rel="stylesheet" type="text/css" href="${href}">`)}
        <title>Salto</title>
    </head>
    <body>
      <div id=container>
        <h1 class="text">Salto Plan</h1>
        <p class="text">Salto will perform the following changes</p>
        ${htmlDiff}
      </div>
    </body>
    </html>`
}

const createPlanDiff = async (planActions: Plan): Promise<UnifiedDiff> => {
  const diffCreators = wu(planActions.itemsByEvalOrder())
    .map(item => wu(item.changes()).toArray())
    .flatten()
    .enumerate()
    .map(([change, i]) => createChangeDiff(i, change.data.before, change.data.after))
    .toArray()
  const diff = (await Promise.all(diffCreators)).join('\n')
  return diff
}

const displayPlan = async (
  planActions: Plan,
  extensionPath: string
): Promise<void> => vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: 'Creating apply plan',
},
async () => {
  const diff = await createPlanDiff(planActions)
  return displayHTML(renderDiffView(diff, extensionPath))
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
  const message = wu(action.changes())
    .flatten()
    .map(change => getActionName(change.data.before, change.data.after))
    .toArray()
    .join('\n')
  progress.report({ message })
}

const initProgress = (
  processPromise: Promise<Plan>,
  retValue: vscode.Progress<{message: string}>
): vscode.Progress<{message: string}> => {
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Applying plan',
    cancellable: true,
  },
  progress => {
    // We disable this lint as the entire purpose of this function
    // is to pass this pointer back.
    /* eslint-disable-next-line no-param-reassign */
    retValue = progress
    return processPromise
  })
  return retValue
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
  let progress: vscode.Progress<{message: string}>
  let applyProcess: Promise<Plan>
  const shouldApplyCB = async (p: Plan): Promise<boolean> => shouldApply(p, extensionPath)
  const updateActionCB = async (action: PlanItem): Promise<void> => {
    if (!progress) {
      progress = initProgress(applyProcess, progress)
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
