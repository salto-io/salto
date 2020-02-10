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
import * as Diff from 'diff'
import { Diff2Html } from 'diff2html'
import {
  Element, getChangeElement, isObjectType, isInstanceElement, isField, ObjectType, isPrimitiveType,
  PrimitiveType, Field, Value,
} from 'adapter-api'
import { dumpElements, PlanItem } from 'salto'
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
    ? dumpElements([orderByAfterElement(changeData.before, changeData.after)])
    : ''
  const afterHCL = changeData.after
    ? dumpElements([changeData.after])
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
