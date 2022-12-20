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
import _ from 'lodash'
import {
  getFetchTargets,
  SUPPORTED_METADATA_TYPES,
  METADATA_TYPES_WITHOUT_DEPENDENCIES,
  METADATA_TYPES_WITH_DEPENDENCIES,
  EXCLUDED_METADATA_TYPES,
  CUSTOM_OBJECT_DEPENDENCIES,
  WORKFLOW_DEPENDENCIES,
  SupportedMetadataType,
} from '../../src/fetch_profile/metadata_types'

jest.mock('../../src/fetch_profile/metadata_types', () => ({
  ...jest.requireActual('../../src/fetch_profile/metadata_types'),
  get METADATA_TYPE_TO_DEPENDENCIES() {
    return {
      CustomMetadata: ['CustomObject', 'Workflow'],
      CustomObject: ['CustomLabels', 'CustomIndex', 'CustomMetadata'],
      Workflow: ['CustomObject', 'WorkflowAlert'],
    }
  },
}))

describe('Salesforce MetadataTypes', () => {
  const getDuplicates = (array: ReadonlyArray<string>): ReadonlyArray<string> => (
    _(array)
      .groupBy()
      .pickBy(g => g.length > 1)
      .keys()
      .value()
  )
  const isSupportedMetadataType = (typeName: string): boolean => (
    (SUPPORTED_METADATA_TYPES as ReadonlyArray<string>).includes(typeName)
  )
  const isUnsupportedMetadataType = (typeName: string): boolean => (
    !isSupportedMetadataType(typeName)
  )

  // afterAll(() => {
  //   jest.resetAllMocks()
  // })

  it.each([
    ['METADATA_TYPES_WITHOUT_DEPENDENCIES', METADATA_TYPES_WITHOUT_DEPENDENCIES],
    ['METADATA_TYPES_WITH_DEPENDENCIES', METADATA_TYPES_WITH_DEPENDENCIES],
    ['EXCLUDED_METADATA_TYPES', EXCLUDED_METADATA_TYPES],
    ['CUSTOM_OBJECT_DEPENDENCIES', CUSTOM_OBJECT_DEPENDENCIES],
    ['WORKFLOW_DEPENDENCIES', WORKFLOW_DEPENDENCIES],
  ] as [string, ReadonlyArray<string>][])('%p should not contain duplicates', (__, array) => {
    expect(getDuplicates(array)).toBeEmpty()
  })
  it.each([
    ['CUSTOM_OBJECT_DEPENDENCIES', CUSTOM_OBJECT_DEPENDENCIES as ReadonlyArray<string>],
    ['WORKFLOW_DEPENDENCIES', WORKFLOW_DEPENDENCIES as ReadonlyArray<string>],
  ])('%p should contain only supported types', (__, array) => {
    expect(array.filter(isUnsupportedMetadataType)).toBeEmpty()
  })
  it('excluded types should not be in supported types', () => {
    expect(EXCLUDED_METADATA_TYPES.filter(isSupportedMetadataType)).toBeEmpty()
  })
  it('types with dependencies should not overlap with types without dependencies', () => {
    const overlappingTypes = getDuplicates([
      ..._.uniq(METADATA_TYPES_WITH_DEPENDENCIES),
      ..._.uniq(METADATA_TYPES_WITHOUT_DEPENDENCIES),
    ])
    expect(overlappingTypes).toBeEmpty()
  })
  describe('getFetchTargets', () => {
    describe('when fetch targets dont include any types with dependencies', () => {
      it('should return the same list', () => {
        const target: SupportedMetadataType[] = ['CustomLabels', 'WorkflowFieldUpdate', 'WorkflowAlert']
        expect(getFetchTargets([...target])).toEqual(target)
      })
    })
    describe('when fetch targets include types with dependencies', () => {
      it('should return a list with the correct types', () => {
        expect(getFetchTargets([...METADATA_TYPES_WITH_DEPENDENCIES])).toIncludeSameMembers([
          'CustomMetadata',
          'CustomObject',
          'Workflow',
          'WebLink',
          'ValidationRule',
          'BusinessProcess',
          'RecordType',
          'ListView',
          'FieldSet',
          'CompactLayout',
          'SharingReason',
          'Index',
          'WorkflowAlert',
          'WorkflowFieldUpdate',
          'WorkflowFlowAction',
          'WorkflowOutboundMessage',
          'WorkflowKnowledgePublish',
          'WorkflowTask',
          'WorkflowRule',
        ])
      })
    })
  })
})
