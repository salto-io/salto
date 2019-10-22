import * as Diff from 'diff'
import { Diff2Html } from 'diff2html'
import { Element, getChangeElement } from 'adapter-api'
import { parser, plan } from 'salto'
import wu from 'wu'

export type UnifiedDiff = string

export const getActionName = (
  change: plan.PlanItem,
  presentSimpleForm = true
): string => {
  const getActionType = (): string => {
    const { action } = change.parent()
    if (action === 'modify') return (presentSimpleForm) ? 'Modify' : 'Modifing'
    if (action === 'remove') return (presentSimpleForm) ? 'Delete' : 'Deleting'
    return (presentSimpleForm) ? 'Add' : 'Adding'
  }
  const changeElement = getChangeElement(change.parent())
  return `${getActionType()} ${changeElement.elemID.getFullName()}`
}

export const createChangeDiff = async (
  stepIndex: number,
  change: plan.PlanItem
): Promise<UnifiedDiff> => {
  const changeData = change.parent().data as {before?: Element; after?: Element}
  const beforeHCL = changeData.before ? parser.dump([changeData.before]) : ''
  const afterHCL = changeData.after ? parser.dump([changeData.after]) : ''
  const step = `Step ${stepIndex} - `
  const patchName = `${step}${getActionName(change)}`
  return Diff.createPatch(
    patchName,
    await beforeHCL,
    await afterHCL,
  )
}

export const renderDiffView = (diff: UnifiedDiff, cssHrefs: string[]): string => {
  const htmlDiff = Diff2Html.getPrettyHtml(diff, { inputFormat: 'diff' })
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

export const createPlanDiff = async (
  planActions: Iterable<plan.PlanItem>,
): Promise<UnifiedDiff> => {
  const diffCreators = wu(planActions)
    .enumerate()
    .map(([change, i]) => createChangeDiff(i, change))
  const diff = (await Promise.all(diffCreators)).join('\n')
  return diff
}
