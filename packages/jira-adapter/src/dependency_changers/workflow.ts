/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  dependencyChange,
  DependencyChanger,
  getAllChangeData,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  Values,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { WORKFLOW_SCHEME_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../constants'

const getWorkflowSchemeReferences = (instance: InstanceElement): string[] =>
  [...(instance.value.items?.map((item: Values) => item.workflow) ?? []), instance.value.defaultWorkflow]
    .filter(isResolvedReferenceExpression)
    .map(ref => ref.elemID.getFullName())

/**
 * We modify workflows by deleting and re-creating them. To do so we need to modify
 * the workflow schemes that have references to the modified workflow, so we would
 * want the workflow scheme to depends on the workflows modifications as it depends
 * on workflows additions.
 */
export const workflowDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const workflowModifications = instanceChanges
    .filter(({ change }) => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
    .filter(({ change }) => isModificationChange(change))

  const idToWorkflowModification = _.keyBy(workflowModifications, ({ change }) =>
    getChangeData(change).elemID.getFullName(),
  )

  const workflowSchemeChanges = instanceChanges.filter(
    ({ change }) => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE_NAME,
  )

  return workflowSchemeChanges.flatMap(({ key: workflowSchemeKey, change: workflowSchemeChange }) => {
    const ids = _(getAllChangeData(workflowSchemeChange)).flatMap(getWorkflowSchemeReferences).uniq().value()

    return ids
      .map(id => idToWorkflowModification[id])
      .filter(values.isDefined)
      .map(({ key: workflowKey }) => dependencyChange('add', workflowSchemeKey, workflowKey))
  })
}
