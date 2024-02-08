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
import { InstanceElement, Value } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { UserFetchConfig } from '../../definitions/user'

export const ALL_TYPES = '.*'

export const INCLUDE_ALL_CONFIG = {
  include: [{
    type: ALL_TYPES,
  }],
  exclude: [],
}

export type ElementQuery = {
  isTypeMatch: (typeName: string) => boolean
  isInstanceMatch: (instance: InstanceElement) => boolean
}

export type QueryCriterion = (
  args: {
    instance: InstanceElement
    value: Value
  }
) => boolean

const isTypeMatch = (typeName: string, typeRegex: string): boolean =>
  new RegExp(`^${typeRegex}$`).test(typeName)

const isPredicatesMatch = (
  instance: InstanceElement,
  criteria: Record<string, QueryCriterion>,
  criteriaValues: Record<string, unknown>,
): boolean => Object.entries(criteriaValues)
  .filter(([key]) => key in criteria)
  .every(([key, value]) => criteria[key]({ instance, value }))

export const createElementQuery = <T extends Record<string, unknown>>(
  fetchConfig: UserFetchConfig<T | undefined>,
  allCriteria: Record<string, QueryCriterion> = {},
): ElementQuery => ({
    isTypeMatch: (typeName: string) => {
      const { include, exclude } = fetchConfig
      const isIncluded = include.some(({ type: typeRegex }) =>
        isTypeMatch(typeName, typeRegex))

      const isExcluded = exclude
        .filter(({ criteria }) => criteria === undefined)
        .some(({ type: excludedType }) =>
          isTypeMatch(typeName, excludedType))

      return isIncluded && !isExcluded
    },

    isInstanceMatch: (instance: InstanceElement) => {
      const { include, exclude } = fetchConfig
      const isIncluded = include.some(({ type, criteria }) =>
        isTypeMatch(instance.elemID.typeName, type)
      && (criteria === undefined || isPredicatesMatch(instance, allCriteria, criteria)))

      const isExcluded = exclude.some(({ type, criteria }) =>
        isTypeMatch(instance.elemID.typeName, type)
      && (criteria === undefined || isPredicatesMatch(instance, allCriteria, criteria)))

      return isIncluded && !isExcluded
    },
  })

export const createMockQuery = (): MockInterface<ElementQuery> => ({
  isTypeMatch: jest.fn().mockReturnValue(true),
  isInstanceMatch: jest.fn().mockReturnValue(true),
})
