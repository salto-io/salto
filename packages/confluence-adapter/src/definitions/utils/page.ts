/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ActionName,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { concatAdjustFunctions, definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { PAGE_TYPE_NAME, SPACE_TYPE_NAME } from '../../constants'
import { AdditionalAction } from '../types'
import { validateValue } from './generic'
import { createAdjustUserReferencesReverse } from './users'
import { increaseVersion } from './version'

const log = logger(module)

/**
 * If page is a homepage of a space and both are being deployed as addition to some environment,
 * We first deploy the space and then we modify its homepage (default homepage is created in the service when creating new space).
 * This function will switch the action from 'add' to 'modify' in case of homepage addition.
 */
export const homepageAdditionToModification: ({
  change,
  changeGroup,
  elementSource,
}: definitions.deploy.ChangeAndContext) => (ActionName | AdditionalAction)[] = ({ change, changeGroup }) => {
  const spaceChange = changeGroup.changes.find(c => getChangeData(c).elemID.typeName === SPACE_TYPE_NAME)
  if (isAdditionChange(change) && spaceChange !== undefined && isInstanceChange(spaceChange)) {
    const changeData = getChangeData(change)
    const spaceChangeData = getChangeData(spaceChange)
    const spaceRef = _.get(changeData.value, 'spaceId')
    if (isReferenceExpression(spaceRef) && spaceRef.elemID.isEqual(spaceChangeData.elemID)) {
      log.debug(
        'Found space change: %s in the same changeGroup as page: %s, changing page addition to modify',
        spaceChangeData.elemID.getFullName(),
        changeData.elemID.getFullName(),
      )
      return ['modify']
    }
  }
  return [change.action]
}

/**
 * custom context function that adds homepage id to additionContext in case it is a homepage of a new deployed space.
 */
export const putHomepageIdInAdditionContext = (args: definitions.deploy.ChangeAndContext): Record<string, unknown> => {
  const spaceChange = args.changeGroup?.changes.find(c => getChangeData(c).elemID.typeName === SPACE_TYPE_NAME)
  if (spaceChange === undefined) {
    return {}
  }
  // If there is a space change on the same group as a page change, it means that the page is the space homepage
  const homepageId = _.get(args.sharedContext?.[getChangeData(spaceChange).elemID.getFullName()], 'id')
  if (homepageId !== undefined) {
    return { id: homepageId }
  }
  return {}
}

/**
 * AdjustFunction that update the page id in case it is a homepage of a new deployed space.
 */
const updateHomepageId: definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> = async args => {
  const value = validateValue(args.value)
  const spaceChange = args.context.changeGroup.changes.find(c => getChangeData(c).elemID.typeName === SPACE_TYPE_NAME)
  if (spaceChange === undefined) {
    return { value }
  }
  // If there is a space change on the same group as a page change, it means that the page is the space homepage
  const homepageId = _.get(args.context.sharedContext[getChangeData(spaceChange).elemID.getFullName()], 'id')
  if (homepageId !== undefined) {
    value.id = homepageId
  }
  return { value }
}

export const adjustUserReferencesOnPageReverse = createAdjustUserReferencesReverse(PAGE_TYPE_NAME)

/**
 * AdjustFunction that runs all page modification adjust functions.
 */
export const adjustPageOnModification = concatAdjustFunctions<definitions.deploy.ChangeAndExtendedContext>(
  increaseVersion,
  updateHomepageId,
  adjustUserReferencesOnPageReverse,
)
