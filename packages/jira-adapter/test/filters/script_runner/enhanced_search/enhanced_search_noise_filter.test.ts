/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils } from '@salto-io/adapter-components'
import { InstanceElement } from '@salto-io/adapter-api'
import { createEmptyType, getFilterParams } from '../../../utils'
import { FILTER_TYPE_NAME } from '../../../../src/constants'
import enhancedSearchNoiseFilter from '../../../../src/filters/script_runner/enhanced_search/enhanced_search_noise_filter'

type FilterType = filterUtils.FilterWith<'onFetch'>

describe('enhancedSearchNoiseFilter', () => {
  let filter: FilterType
  let instance: InstanceElement

  beforeEach(() => {
    instance = new InstanceElement('instance', createEmptyType(FILTER_TYPE_NAME), {
      description: 'Filter managed by Enhanced Search: issueFunction in linkedIssuesOf',
      jql: 'issue in (1, 2, 3)',
    })
    filter = enhancedSearchNoiseFilter(getFilterParams()) as FilterType
  })
  it('should replace noise in jql', async () => {
    await filter.onFetch([instance])
    expect(instance.value.jql).toEqual('ENHANCED_SEARCH_ISSUE_TERMS')
  })
  it('should replace noise in jql for older versions', async () => {
    instance.value.description = 'Filter managed by ScriptRunner: issueFunction in linkedIssuesOf'
    await filter.onFetch([instance])
    expect(instance.value.jql).toEqual('ENHANCED_SEARCH_ISSUE_TERMS')
  })
  it('should not replace noise in jql if there is no closing bracket', async () => {
    instance.value.jql = 'issue in (1, 2, 3'
    await filter.onFetch([instance])
    expect(instance.value.jql).toEqual('issue in (1, 2, 3')
  })
  it('should not replace noise in jql if there is no opening bracket', async () => {
    instance.value.jql = 'issue in 1, 2, 3)'
    await filter.onFetch([instance])
    expect(instance.value.jql).toEqual('issue in 1, 2, 3)')
  })
  it('should not replace noise in jql if there is no jql', async () => {
    instance.value.jql = undefined
    await filter.onFetch([instance])
    expect(instance.value.jql).toBeUndefined()
  })
  it('should not replace noise in jql if it is not an enhanced search filter', async () => {
    instance.value.description = 'description'
    await filter.onFetch([instance])
    expect(instance.value.jql).toEqual('issue in (1, 2, 3)')
  })
  it('should not replace noise in jql if it is there is no description', async () => {
    instance.value.description = undefined
    await filter.onFetch([instance])
    expect(instance.value.jql).toEqual('issue in (1, 2, 3)')
  })
})
