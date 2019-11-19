import * as Diff from 'diff'
import { Diff2Html } from 'diff2html'
import { Element, getChangeElement, isObjectType, isInstanceElement, isField, ObjectType, isPrimitiveType, PrimitiveType, Field, Value } from 'adapter-api'
import { dump, PlanItem } from 'salto'
import wu from 'wu'
import _ from 'lodash'

export type UnifiedDiff = string

const orderByAfterElement = (target: Element, ref: Element | undefined): Element => {
  const orderMapBy = (
    targetMap: Record<string, Value|Element|Field>,
    refMap: Record<string, Value|Element|Field>
  ): Record<string, Value|Element|Field> => _(targetMap)
    .toPairs()
    .sortBy(([key, _v]) => _.keys(refMap).indexOf(key))
    .fromPairs()
    .value()

  if (isObjectType(target) && isObjectType(ref)) {
    return new ObjectType({
      elemID: target.elemID,
      fields: orderMapBy(target.fields, ref.fields),
      annotationTypes: orderMapBy(target.annotationTypes, ref.annotationTypes),
      annotations: orderMapBy(target.annotations, ref.annotations),
    })
  }

  if (isPrimitiveType(target) && isPrimitiveType(ref)) {
    return new PrimitiveType({
      elemID: target.elemID,
      primitive: target.primitive,
      annotationTypes: orderMapBy(target.annotationTypes, ref.annotationTypes),
      annotations: orderMapBy(target.annotations, ref.annotations),
    })
  }

  if (isField(target) && isField(ref)) {
    return new Field(
      target.parentID,
      target.name,
      target.type,
      orderMapBy(target.annotations, ref.annotations),
      target.isList
    )
  }

  if (isInstanceElement(target) && isInstanceElement(ref)) {
    const res = target.clone()
    res.value = orderMapBy(target.value, ref.value)
    return res
  }

  return target
}

export const getActionName = (
  change: PlanItem,
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
  change: PlanItem,
): Promise<UnifiedDiff> => {
  const changeData = change.parent().data as {before?: Element; after?: Element}
  const beforeHCL = changeData.before
    ? dump([orderByAfterElement(changeData.before, changeData.after)])
    : ''
  const afterHCL = changeData.after
    ? dump([changeData.after])
    : ''
  const step = `Step ${stepIndex} - `
  const patchName = `${step}${getActionName(change)}`
  return Diff.createPatch(
    patchName,
    await beforeHCL,
    await afterHCL,
  )
}

export const renderDiffView = (diff: UnifiedDiff, cssHrefs: string[]): string => {
  const htmlDiff = diff.length > 0
    ? Diff2Html.getPrettyHtml(diff, { inputFormat: 'diff' })
    : ''
  const prompt = diff.length > 0
    ? 'Salto will perform the following changes'
    : 'Nothing to do'
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${cssHrefs.map(href => `<link rel="stylesheet" type="text/css" href="${href}">`).join('')}
        <title>Salto Preview</title>
    </head>
    <body>
      <div id=container>
        <h1 class="text">Salto Preview</h1>
        <p class="text">${prompt}</p>
        ${htmlDiff}
      </div>
    </body>
    </html>`
}

export const createPlanDiff = async (
  planActions: Iterable<PlanItem>
): Promise<UnifiedDiff> => {
  const diffCreators = wu(planActions)
    .enumerate()
    .map(([change, i]) => createChangeDiff(i, change))
  const diff = (await Promise.all(diffCreators)).join('\n')
  return diff
}
