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
import { MockInterface } from '@salto-io/test-utils'
import { UserFetchConfig } from '../config'

export const INCLUDE_ALL_CONFIG = {
  include: [{
    type: '.*',
  }],
  exclude: [],
}

export type ElementQuery = {
  isTypeMatch: (typeName: string) => boolean
}

const isTypeMatch = (typeName: string, typeRegex: string): boolean =>
  new RegExp(`^${typeRegex}$`).test(typeName)

export const createElementQuery = (
  fetchConfig: UserFetchConfig
): ElementQuery => ({
  isTypeMatch: (typeName: string) => {
    const { include, exclude } = fetchConfig
    const isIncluded = include.some(({ type: typeRegex }) =>
      isTypeMatch(typeName, typeRegex))

    const isExcluded = exclude.some(({ type: excludedType }) =>
      isTypeMatch(typeName, excludedType))

    return isIncluded && !isExcluded
  },
})

export const createMockQuery = (): MockInterface<ElementQuery> => ({
  isTypeMatch: jest.fn().mockReturnValue(true),
})
