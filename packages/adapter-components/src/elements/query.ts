/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { UserFetchConfig } from '../config'

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

export type QueryPredicate = (
  args: {
    instance: InstanceElement
    filterValue: Value
  }
) => boolean

const isTypeMatch = (typeName: string, typeRegex: string): boolean =>
  new RegExp(`^${typeRegex}$`).test(typeName)

const isPredicatesMatch = (
  instance: InstanceElement,
  predicates: Record<string, QueryPredicate>,
  filters: Record<string, unknown>,
): boolean => Object.entries(filters)
  .filter(([key]) => key in predicates)
  .every(([key, value]) => predicates[key]({ instance, filterValue: value }))

export const createElementQuery = <T extends Record<string, unknown>>(
  fetchConfig: UserFetchConfig<T | undefined>,
  predicates: Record<string, QueryPredicate> = {},
): ElementQuery => ({
    isTypeMatch: (typeName: string) => {
      const { include, exclude } = fetchConfig
      const isIncluded = include.some(({ type: typeRegex }) =>
        isTypeMatch(typeName, typeRegex))

      const isExcluded = exclude
        .filter(({ filters }) => filters === undefined)
        .some(({ type: excludedType }) =>
          isTypeMatch(typeName, excludedType))

      return isIncluded && !isExcluded
    },

    isInstanceMatch: (instance: InstanceElement) => {
      const { include, exclude } = fetchConfig
      const isIncluded = include.some(({ type, filters }) =>
        isTypeMatch(instance.elemID.typeName, type)
      && (filters === undefined || isPredicatesMatch(instance, predicates, filters)))

      const isExcluded = exclude.some(({ type, filters }) =>
        isTypeMatch(instance.elemID.typeName, type)
      && (filters === undefined || isPredicatesMatch(instance, predicates, filters)))

      return isIncluded && !isExcluded
    },
  })

export const createMockQuery = (): MockInterface<ElementQuery> => ({
  isTypeMatch: jest.fn().mockReturnValue(true),
  isInstanceMatch: jest.fn().mockReturnValue(true),
})
