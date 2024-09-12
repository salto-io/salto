/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, InstanceElement } from '@salto-io/adapter-api'
import { enhancedSearchDeploymentValidator } from '../../../src/change_validators/script_runner/enhanced_search_deployment'
import { createEmptyType } from '../../utils'
import { FILTER_TYPE_NAME } from '../../../src/constants'

describe('enhancedSearchDeploymentValidator', () => {
  let instances: InstanceElement[] = []
  const filterType = createEmptyType(FILTER_TYPE_NAME)
  beforeEach(() => {
    instances = [
      new InstanceElement('instance1', filterType, {
        description: 'Filter managed by Enhanced Search: issueFunction in linkedIssuesOf',
        jql: 'ENHANCED_SEARCH_ISSUE_TERMS',
      }),
      new InstanceElement('instance2', filterType, {
        description: 'description',
        jql: 'ENHANCED_SEARCH_ISSUE_TERMS',
      }),
      new InstanceElement('instance3', filterType, {
        description: 'Filter managed by Enhanced Search: ',
        jql: 'ENHANCED_SEARCH_ISSUE_TERMS with more text',
      }),
    ]
  })
  it('should issue an error for an addition change', async () => {
    expect(await enhancedSearchDeploymentValidator([toChange({ after: instances[0] })])).toEqual([
      {
        elemID: instances[0].elemID,
        severity: 'Error',
        message: 'Filters created by Enhanced Search cannot be deployed',
        detailedMessage: 'Salto does not support Enhanced Search, and cannot deploy filters created by it.',
      },
    ])
  })
  it('should issue an error for a modification change', async () => {
    expect(await enhancedSearchDeploymentValidator([toChange({ before: instances[0], after: instances[0] })])).toEqual([
      {
        elemID: instances[0].elemID,
        severity: 'Error',
        message: 'Filters created by Enhanced Search cannot be deployed',
        detailedMessage: 'Salto does not support Enhanced Search, and cannot deploy filters created by it.',
      },
    ])
  })
  it('should not issue an error for a change that is not an enhanced search filter', async () => {
    expect(await enhancedSearchDeploymentValidator([toChange({ after: instances[1] })])).toEqual([])
  })
  it('should not issue an error for a change that is not a filter', async () => {
    const change = toChange({
      after: new InstanceElement('instance3', createEmptyType('notFilter'), {
        description: 'Filter managed by Enhanced Search: issueFunction in linkedIssuesOf',
        jql: 'ENHANCED_SEARCH_ISSUE_TERMS',
      }),
    })
    expect(await enhancedSearchDeploymentValidator([change])).toEqual([])
  })
  it('should not issue an error for a removal change', async () => {
    expect(await enhancedSearchDeploymentValidator([toChange({ before: instances[0] })])).toEqual([])
  })
  it('should return the correct error messages for several changes', async () => {
    expect(
      await enhancedSearchDeploymentValidator([
        toChange({ after: instances[0] }),
        toChange({ after: instances[1] }),
        toChange({ after: instances[2] }),
      ]),
    ).toEqual([
      {
        elemID: instances[0].elemID,
        severity: 'Error',
        message: 'Filters created by Enhanced Search cannot be deployed',
        detailedMessage: 'Salto does not support Enhanced Search, and cannot deploy filters created by it.',
      },
      {
        elemID: instances[2].elemID,
        severity: 'Error',
        message: 'Filters created by Enhanced Search cannot be deployed',
        detailedMessage: 'Salto does not support Enhanced Search, and cannot deploy filters created by it.',
      },
    ])
  })
})
