/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import {
  ActionName,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { SPACE_TYPE_NAME } from '../../constants'
import { AdditionalAction } from '../types'
import { validateValue } from './generic'

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

const isNumber = (value: unknown): value is number => typeof value === 'number'

/**
 * AdjustFunction that increases the version number of a page for deploy modification change.
 */
const increasePageVersion: definitions.AdjustFunction<definitions.deploy.ChangeAndContext> = args => {
  const value = validateValue(args.value)
  const version = _.get(value, 'version')
  if (!values.isPlainRecord(version) || !isNumber(version.number)) {
    return {
      value: {
        ...value,
        version: {
          // In case of homepage addition, we don't have a version number yet but it is "1" in the service
          // It has been set to one when we created the space and the default homepage was created
          number: 2,
        },
      },
    }
  }
  return {
    value: {
      ...value,
      version: {
        ...version,
        number: version.number + 1,
      },
    },
  }
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
const updateHomepageId: definitions.AdjustFunction<definitions.deploy.ChangeAndContext> = args => {
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

/**
 * AdjustFunction that runs all page modification adjust functions.
 */
export const adjustPageOnModification: definitions.AdjustFunction<definitions.deploy.ChangeAndContext> = args => {
  const value = validateValue(args.value)
  const argsWithValidatedValue = { ...args, value }
  return [increasePageVersion, updateHomepageId].reduce(
    (input, func) => ({ ...argsWithValidatedValue, ...func(input) }),
    argsWithValidatedValue,
  )
}
