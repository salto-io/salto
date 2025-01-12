/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, Value } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { UserFetchConfig, UserFetchConfigOptions } from '../../definitions/user'

export const ALL_TYPES = '.*'

export const INCLUDE_ALL_CONFIG = {
  include: [
    {
      type: ALL_TYPES,
    },
  ],
  exclude: [],
}

export type ElementQuery = {
  isTypeMatch: (typeName: string) => boolean
  isInstanceMatch: (instance: InstanceElement) => boolean
}

export type QueryCriterion = (args: { instance: InstanceElement; value: Value }) => boolean

export const isTypeMatch = (typeName: string, typeRegex: string): boolean => new RegExp(`^${typeRegex}$`).test(typeName)

const isPredicatesMatch = (
  instance: InstanceElement,
  criteria: Record<string, QueryCriterion>,
  criteriaValues: Record<string, unknown>,
): boolean =>
  Object.entries(criteriaValues)
    .filter(([key]) => key in criteria)
    .every(([key, value]) => criteria[key]({ instance, value }))

export const createElementQuery = <Options extends UserFetchConfigOptions>(
  fetchConfig: UserFetchConfig<Options>,
  allCriteria: Record<string, QueryCriterion> = {},
): ElementQuery => ({
  isTypeMatch: (typeName: string) => {
    const { include, exclude } = fetchConfig
    const isIncluded = include.some(({ type: typeRegex }) => isTypeMatch(typeName, typeRegex))

    const isExcluded = exclude
      .filter(({ criteria }) => criteria === undefined)
      .some(({ type: excludedType }) => isTypeMatch(typeName, excludedType))

    return isIncluded && !isExcluded
  },

  isInstanceMatch: (instance: InstanceElement) => {
    const { include, exclude } = fetchConfig
    const isIncluded = include.some(
      ({ type, criteria }) =>
        isTypeMatch(instance.elemID.typeName, type) &&
        (criteria === undefined || isPredicatesMatch(instance, allCriteria, criteria)),
    )

    const isExcluded = exclude.some(
      ({ type, criteria }) =>
        isTypeMatch(instance.elemID.typeName, type) &&
        (criteria === undefined || isPredicatesMatch(instance, allCriteria, criteria)),
    )

    return isIncluded && !isExcluded
  },

  // TODO add request-time optimizations where relevant (SALTO-5425)
})

export const createMockQuery = (): MockInterface<ElementQuery> => ({
  isTypeMatch: jest.fn().mockReturnValue(true),
  isInstanceMatch: jest.fn().mockReturnValue(true),
})
