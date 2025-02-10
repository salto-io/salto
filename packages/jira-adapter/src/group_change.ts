/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  getChangeData,
  isModificationChange,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { getParent, getParents, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
import {
  FIELD_CONFIGURATION_ITEM_TYPE_NAME,
  ISSUE_LINK_TYPE_NAME,
  OBJECT_TYPE_ATTRIBUTE_TYPE,
  QUEUE_TYPE,
  SCRIPT_FRAGMENT_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
  SECURITY_LEVEL_TYPE,
  SLA_TYPE_NAME,
  WORKFLOW_TYPE_NAME,
} from './constants'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from './filters/fields/constants'
import { getContextParent } from './common/fields'

const getWorkflowGroup: deployment.grouping.ChangeIdFunction = async change =>
  isModificationChange(change) && getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME
    ? 'Workflow Modifications'
    : undefined

const getIssueLinkTypeGroup: deployment.grouping.ChangeIdFunction = async change =>
  isRemovalChange(change) && getChangeData(change).elemID.typeName === ISSUE_LINK_TYPE_NAME
    ? 'IssueLinkType Removals'
    : undefined

const getSecurityLevelGroup: deployment.grouping.ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (!isAdditionChange(change) || instance.elemID.typeName !== SECURITY_LEVEL_TYPE) {
    return undefined
  }

  const parents = getParents(instance)
  if (parents.length !== 1 || !isResolvedReferenceExpression(parents[0])) {
    throw new Error(`${instance.elemID.getFullName()} must have exactly one reference expression parent`)
  }

  return parents[0].elemID.getFullName()
}

const getFieldConfigItemGroup: deployment.grouping.ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (instance.elemID.typeName !== FIELD_CONFIGURATION_ITEM_TYPE_NAME) {
    return undefined
  }

  const parent = getParent(instance)

  return `${parent.elemID.getFullName()} items`
}

const getFieldContextGroup: deployment.grouping.ChangeIdFunction = async change => {
  const instance = getChangeData(change)

  return isInstanceElement(instance) &&
    (instance.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME ||
      // we group the order only when it is a removal change. We want it separate for id updates,
      // but on removal it breaks the grouping due to dependency changes
      (instance.elemID.typeName === OPTIONS_ORDER_TYPE_NAME && isRemovalChange(change)))
    ? getContextParent(instance).elemID.getFullName()
    : undefined
}

const getScriptListenersGroup: deployment.grouping.ChangeIdFunction = async change =>
  getChangeData(change).elemID.typeName === SCRIPT_RUNNER_LISTENER_TYPE ? 'Script Listeners' : undefined

const getScriptedFragmentsGroup: deployment.grouping.ChangeIdFunction = async change =>
  getChangeData(change).elemID.typeName === SCRIPT_FRAGMENT_TYPE ? 'Scripted Fragments' : undefined

const getQueuesAdditionByProjectGroup: deployment.grouping.ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (!isAdditionChange(change) || instance.elemID.typeName !== QUEUE_TYPE) {
    return undefined
  }
  const parent = getParent(instance)
  return `queue addition of ${parent.elemID.getFullName()}`
}
const getAttributeAdditionByObjectTypeGroup: deployment.grouping.ChangeIdFunction = async change => {
  if (
    isAdditionChange(change) &&
    isInstanceChange(change) &&
    getChangeData(change).elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE
  ) {
    const instance = getChangeData(change)
    return `attribute addition of ${instance.value.objectType.elemID.getFullName()}`
  }
  return undefined
}
const getSlaAdditionByProjectGroup: deployment.grouping.ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (!isAdditionChange(change) || instance.elemID.typeName !== SLA_TYPE_NAME) {
    return undefined
  }
  const parent = getParent(instance)
  return `sla addition of ${parent.elemID.getFullName()}`
}

export const getChangeGroupIds = deployment.grouping.getChangeGroupIdsFunc([
  getWorkflowGroup,
  getSecurityLevelGroup,
  getFieldConfigItemGroup,
  getScriptListenersGroup,
  getScriptedFragmentsGroup,
  getQueuesAdditionByProjectGroup,
  getAttributeAdditionByObjectTypeGroup,
  getFieldContextGroup,
  getSlaAdditionByProjectGroup,
  getIssueLinkTypeGroup,
])
