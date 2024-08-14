/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { Change, Element, isField } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'

export const isElementContainsStringValue = (element: Element, expectedValue: string): boolean => {
  let foundValue = false
  walkOnElement({
    element,
    func: ({ value }) => {
      if (_.isString(value) && value.includes(expectedValue)) {
        foundValue = true
        return WALK_NEXT_STEP.EXIT
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return foundValue
}

export const cloneChange = <T extends Change>(change: T): T =>
  ({
    action: change.action,
    data: _.mapValues(change.data, (element: Element) =>
      isField(element) ? element.parent.clone().fields[element.name] : element.clone(),
    ),
  }) as T
