/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'

export type JiraIndex = {
  projectByKey: Record<string, Readonly<InstanceElement>>
  issueTypeByName: Record<string, Readonly<InstanceElement>>
  fieldById: Record<string, ElemID>
}

const toKey = (element: Readonly<Element>): string | undefined =>
  isInstanceElement(element) ? element.value.key : undefined

const issueTypeToName = (element: Readonly<Element>): string | undefined => {
  if (isInstanceElement(element) && element.value.name !== undefined) {
    return element.value.name === 'Sub-task' ? 'Subtask' : element.value.name
  }
  return undefined
}

const toId = (element: Readonly<Element>): string | undefined =>
  isInstanceElement(element) ? element.value.id : undefined

export const indexJira = (elements: ReadonlyArray<Readonly<Element>>): JiraIndex => {
  const indexProjectsByKey = _.keyBy(
    elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === 'Project')
      .filter(inst => toKey(inst) !== undefined),
    inst => toKey(inst) as string,
  )

  const indexIssueTypesByName = _.keyBy(
    elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === 'IssueType')
      .filter(inst => issueTypeToName(inst) !== undefined),
    inst => issueTypeToName(inst) as string,
  )

  const indexFieldsById = _.mapValues(
    _.keyBy(
      elements
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === 'Field')
        .filter(e => toId(e) !== undefined),
      e => toId(e) as string,
    ),
    e => e.elemID,
  )

  return {
    issueTypeByName: indexIssueTypesByName,
    projectByKey: indexProjectsByKey,
    fieldById: indexFieldsById,
  }
}
