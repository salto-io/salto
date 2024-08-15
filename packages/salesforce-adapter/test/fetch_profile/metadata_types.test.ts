/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import {
  getFetchTargetsWithDependencies,
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
      .pickBy(g => g.length > 1)
      .keys()
      .value()
  const isSupportedMetadataType = (typeName: string): boolean =>
    (SUPPORTED_METADATA_TYPES as ReadonlyArray<string>).includes(typeName)
  const isUnsupportedMetadataType = (typeName: string): boolean => !isSupportedMetadataType(typeName)

  it('should not contain duplicates', () => {
    expect(getDuplicates(SALESFORCE_METADATA_TYPES)).toBeEmpty()
  })
  it.each([
    ['CUSTOM_OBJECT_FIELDS', CUSTOM_OBJECT_FIELDS as ReadonlyArray<string>],
    ['WORKFLOW_FIELDS', WORKFLOW_FIELDS as ReadonlyArray<string>],
  ])('%p should contain only supported types', (__, array) => {
    expect(array.filter(isUnsupportedMetadataType)).toBeEmpty()
  })
  describe('getFetchTargetsWithDependencies', () => {
    describe("when fetch targets don't include any types with dependencies", () => {
      it('should return the same list', () => {
        const target: MetadataTypeWithoutDependencies[] = ['CustomLabels', 'Capabilities', 'ChannelLayout']
        expect(getFetchTargetsWithDependencies([...target])).toEqual(target)
      })
    })
    describe('when fetch targets include types with dependencies', () => {
      it('should return a list with the correct types', () => {
        expect(getFetchTargetsWithDependencies([...METADATA_TYPES_WITH_DEPENDENCIES])).toIncludeSameMembers([
          'CustomMetadata',
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
          'CustomObject',
          'Workflow',
        ])
      })
    })
  })
})
