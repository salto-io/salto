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

import { CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { defaultFilterContext } from '../utils'
import { SALESFORCE, TYPES_PATH } from '../../src/constants'
import filterCreator from '../../src/filters/hide_types_folder'

describe('hideTypesFolder filter', () => {
  let filter: Required<ReturnType<typeof filterCreator>>

  describe('onFetch', () => {
    let elementWithinTypesFolder: ObjectType
    let elementNestedWithinTypesFolder: ObjectType
    let elementOutsideTypesFolder: ObjectType

    const toBeHidden = (element: ObjectType): boolean =>
      element.annotations?.[CORE_ANNOTATIONS.HIDDEN] === true

    beforeEach(() => {
      elementWithinTypesFolder = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'First'),
        path: [SALESFORCE, TYPES_PATH, 'First'],
      })
      elementNestedWithinTypesFolder = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'Second'),
        path: [SALESFORCE, TYPES_PATH, 'NestedDir', 'Second'],
      })
      elementOutsideTypesFolder = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'Third'),
        path: [SALESFORCE, 'OtherDir', 'Third'],
      })
    })
    describe('when feature is enabled', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: { optionalFeatures: { hideTypesFolder: true } },
            }),
          },
        }) as typeof filter
      })

      it('should hide elements within the Types folder', async () => {
        await filter.onFetch([
          elementWithinTypesFolder,
          elementNestedWithinTypesFolder,
          elementOutsideTypesFolder,
        ])
        expect(elementWithinTypesFolder).toSatisfy(toBeHidden)
        expect(elementNestedWithinTypesFolder).toSatisfy(toBeHidden)
        expect(elementOutsideTypesFolder).not.toSatisfy(toBeHidden)
      })
    })

    describe('when feature is disabled', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: { optionalFeatures: { hideTypesFolder: false } },
            }),
          },
        }) as typeof filter
      })

      it('should not hide elements within the Types folder', async () => {
        await filter.onFetch([
          elementWithinTypesFolder,
          elementNestedWithinTypesFolder,
          elementOutsideTypesFolder,
        ])
        expect(elementWithinTypesFolder).not.toSatisfy(toBeHidden)
        expect(elementNestedWithinTypesFolder).not.toSatisfy(toBeHidden)
        expect(elementOutsideTypesFolder).not.toSatisfy(toBeHidden)
      })
    })
  })
})
