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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  ObjectType,
} from '@salto-io/adapter-api'
import { ImportantValues } from '@salto-io/adapter-utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { METADATA_TYPE } from '../../src/constants'
import { mockTypes } from '../mock_elements'
import filterCreator from '../../src/filters/important_values_filter'
import { defaultFilterContext } from '../utils'

describe('important values filter', () => {
  const hasImportantValues =
    (...importantValues: string[]): ((type: ObjectType) => boolean) =>
    (type) => {
      if (type.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] === undefined) {
        return false
      }
      const typeImportantValues = (
        type.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] as ImportantValues
      ).map((importantValue) => importantValue.value)
      return importantValues.every((importantValue) =>
        typeImportantValues.includes(importantValue),
      )
    }
  describe('onFetch', () => {
    let nonMetadataType: ObjectType
    let metadataType: ObjectType
    let metadataTypeWithNoImportantValues: ObjectType

    let filter: Required<ReturnType<typeof filterCreator>>

    beforeEach(() => {
      nonMetadataType = new ObjectType({
        elemID: new ElemID('salesforce', 'nonMetadataType'),
        fields: {
          fullName: { refType: BuiltinTypes.STRING },
        },
      })
      metadataType = mockTypes.ApexTrigger.clone()
      metadataTypeWithNoImportantValues = new ObjectType({
        elemID: new ElemID('salesforce', 'metadataTypeWithNoImportantValues'),
        fields: {
          someField: { refType: BuiltinTypes.STRING },
          someOtherField: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: 'Test',
        },
      })
    })
    describe('when feature is disabled', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: { optionalFeatures: { importantValues: false } },
            }),
          },
        }) as typeof filter
      })
      it('should not add important values', async () => {
        await filter.onFetch([
          nonMetadataType,
          metadataType,
          metadataTypeWithNoImportantValues,
        ])
        expect(nonMetadataType).not.toSatisfy(hasImportantValues())
        expect(metadataType).not.toSatisfy(hasImportantValues())
        expect(metadataTypeWithNoImportantValues).not.toSatisfy(
          hasImportantValues(),
        )
      })
    })
    describe('when feature is enabled', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                optionalFeatures: {
                  importantValues: true,
                },
              },
            }),
          },
        }) as typeof filter
      })
      it('should add important values', async () => {
        await filter.onFetch([
          nonMetadataType,
          metadataType,
          metadataTypeWithNoImportantValues,
        ])
        expect(nonMetadataType).not.toSatisfy(hasImportantValues())
        expect(metadataTypeWithNoImportantValues).not.toSatisfy(
          hasImportantValues(),
        )
        expect(metadataType).toSatisfy(
          hasImportantValues('fullName', 'apiVersion', 'content'),
        )
      })
    })
    describe('when additional important values override default ones', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                additionalImportantValues: [
                  { value: 'fullName', indexed: false, highlighted: false },
                  { value: 'apiVersion', indexed: true, highlighted: false },
                ],
                optionalFeatures: {
                  importantValues: true,
                },
              },
            }),
          },
        }) as typeof filter
      })
      it('should add correct important values', async () => {
        await filter.onFetch([
          nonMetadataType,
          metadataType,
          metadataTypeWithNoImportantValues,
        ])
        expect(nonMetadataType).not.toSatisfy(hasImportantValues())
        expect(metadataTypeWithNoImportantValues).not.toSatisfy(
          hasImportantValues(),
        )
        expect(metadataType).toSatisfy(
          hasImportantValues('fullName', 'apiVersion', 'content'),
        )
        expect(
          metadataType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES],
        ).toIncludeAnyMembers([
          { value: 'fullName', indexed: false, highlighted: false },
        ])
      })
    })
    describe('when additional important values are configured', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                additionalImportantValues: [
                  { value: 'someField', indexed: false, highlighted: false },
                  {
                    value: 'someOtherField',
                    indexed: true,
                    highlighted: false,
                  },
                ],
                optionalFeatures: {
                  importantValues: true,
                },
              },
            }),
          },
        }) as typeof filter
      })
      it('should add correct important values', async () => {
        await filter.onFetch([
          nonMetadataType,
          metadataType,
          metadataTypeWithNoImportantValues,
        ])
        expect(nonMetadataType).not.toSatisfy(hasImportantValues())
        expect(metadataTypeWithNoImportantValues).toSatisfy(
          hasImportantValues('someField', 'someOtherField'),
        )
        expect(metadataType).toSatisfy(
          hasImportantValues('fullName', 'apiVersion', 'content'),
        )
      })
    })
  })
})
