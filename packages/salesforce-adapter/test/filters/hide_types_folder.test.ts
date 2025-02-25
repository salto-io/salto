/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { CORE_ANNOTATIONS, ElemID, Field, ObjectType } from '@salto-io/adapter-api'
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
    let fields

    const toBeHidden = (element: ObjectType): boolean => element.annotations?.[CORE_ANNOTATIONS.HIDDEN] === true

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
        await filter.onFetch([elementWithinTypesFolder, elementNestedWithinTypesFolder, elementOutsideTypesFolder])
        expect(elementWithinTypesFolder).toSatisfy(toBeHidden)
        expect(elementNestedWithinTypesFolder).toSatisfy(toBeHidden)
        expect(elementOutsideTypesFolder).not.toSatisfy(toBeHidden)
      })
      describe('when element has inner fields', () => {
        beforeEach(() => {
          fields = {
            mockField__c: new Field(elementWithinTypesFolder.clone(), 'mockField__c', elementWithinTypesFolder.clone()),
          }
          elementWithinTypesFolder.fields = fields
        })
        it('should update inner types fields type to be hidden', async () => {
          expect(
            elementWithinTypesFolder.fields.mockField__c.refType.type?.annotations[CORE_ANNOTATIONS.HIDDEN],
          ).toBeFalsy()
          await filter.onFetch([elementWithinTypesFolder])
          expect(
            elementWithinTypesFolder.fields.mockField__c.refType.type?.annotations[CORE_ANNOTATIONS.HIDDEN],
          ).toBeTrue()
        })
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
        await filter.onFetch([elementWithinTypesFolder, elementNestedWithinTypesFolder, elementOutsideTypesFolder])
        expect(elementWithinTypesFolder).not.toSatisfy(toBeHidden)
        expect(elementNestedWithinTypesFolder).not.toSatisfy(toBeHidden)
        expect(elementOutsideTypesFolder).not.toSatisfy(toBeHidden)
      })
    })
  })
})
