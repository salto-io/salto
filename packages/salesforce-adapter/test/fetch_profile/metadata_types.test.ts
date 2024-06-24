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
import _ from 'lodash'
import {
  getFetchTargets,
  SUPPORTED_METADATA_TYPES,
  METADATA_TYPES_WITH_DEPENDENCIES,
  CUSTOM_OBJECT_FIELDS,
  WORKFLOW_FIELDS,
  SALESFORCE_METADATA_TYPES,
  MetadataTypeWithoutDependencies,
} from '../../src/fetch_profile/metadata_types'

describe('Salesforce MetadataTypes', () => {
  const getDuplicates = (array: ReadonlyArray<string>): ReadonlyArray<string> =>
    _(array)
      .groupBy()
      .pickBy((g) => g.length > 1)
      .keys()
      .value()
  const isSupportedMetadataType = (typeName: string): boolean =>
    (SUPPORTED_METADATA_TYPES as ReadonlyArray<string>).includes(typeName)
  const isUnsupportedMetadataType = (typeName: string): boolean =>
    !isSupportedMetadataType(typeName)

  it('should not contain duplicates', () => {
    expect(getDuplicates(SALESFORCE_METADATA_TYPES)).toBeEmpty()
  })
  it.each([
    ['CUSTOM_OBJECT_FIELDS', CUSTOM_OBJECT_FIELDS as ReadonlyArray<string>],
    ['WORKFLOW_FIELDS', WORKFLOW_FIELDS as ReadonlyArray<string>],
  ])('%p should contain only supported types', (__, array) => {
    expect(array.filter(isUnsupportedMetadataType)).toBeEmpty()
  })
  describe('getFetchTargets', () => {
    describe("when fetch targets don't include any types with dependencies", () => {
      it('should return the same list', () => {
        const target: MetadataTypeWithoutDependencies[] = [
          'CustomLabels',
          'Capabilities',
          'ChannelLayout',
        ]
        expect(getFetchTargets([...target])).toEqual(target)
      })
    })
    describe('when fetch targets include types with dependencies', () => {
      it('should return a list with the correct types', () => {
        expect(
          getFetchTargets([...METADATA_TYPES_WITH_DEPENDENCIES]),
        ).toIncludeSameMembers(['CustomMetadata', 'CustomObject', 'Workflow'])
      })
    })
  })
})
