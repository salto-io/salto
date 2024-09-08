/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import type { ChangeError } from '@salto-io/adapter-api'
import type { Plan, PlanItem } from '@salto-io/core'

expect.extend({
  toBeEmptyPlan(plan?: Plan) {
    const formatPlanItem = (item: PlanItem): string =>
      Array.from(item.changes())
        .flatMap(change => Array.from(change.detailedChanges()))
        .map(change => `${change.action}: ${change.id.getFullName()}`)
        .join('\n')

    const formatChangeError = (error: ChangeError): string =>
      `${error.elemID.getFullName()}: ${error.message} (${error.detailedMessage})`

    const formatPlan = (): string => {
      if (plan === undefined) {
        return 'undefined'
      }
      if (plan.size === 0 && plan.changeErrors.length === 0) {
        return 'empty plan'
      }
      return ['changes:']
        .concat(Array.from(plan.itemsByEvalOrder()).map(formatPlanItem))
        .concat(['errors:'])
        .concat(plan.changeErrors.map(formatChangeError))
        .join('\n')
    }

    const createMessage = (expected: string): string =>
      [
        this.utils.matcherHint('toBeEmptyPlan', undefined, ''),
        '',
        `Expected: ${this.utils.printExpected(expected)}`,
        `Received: ${this.utils.printReceived(formatPlan())}`,
      ].join('\n')

    if (plan?.size === 0 && plan?.changeErrors.length === 0) {
      return {
        message: () => createMessage('non empty plan'),
        pass: true,
      }
    }

    return {
      message: () => createMessage('empty plan'),
      pass: false,
    }
  },
})

interface CustomMatchers<R = unknown> {
  toBeEmptyPlan(): R
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}
