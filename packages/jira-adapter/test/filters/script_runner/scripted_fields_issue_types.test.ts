/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils } from '@salto-io/adapter-components'
import { InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import scriptedFieldsIssueTypeFilter from '../../../src/filters/script_runner/scripted_fields_issue_types'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { SCRIPTED_FIELD_TYPE } from '../../../src/constants'

type FilterType = filterUtils.FilterWith<'onDeploy' | 'preDeploy'>

describe('scripted_fields_issue_types', () => {
  let filter: FilterType
  let instance: InstanceElement
  beforeEach(() => {
    const scriptedFields = createEmptyType(SCRIPTED_FIELD_TYPE)
    const issueTypes = createEmptyType('issueType')
    const issueType1 = new InstanceElement('issueType1', issueTypes, {
      id: '1',
      name: 'issueType1',
    })
    const issueType2 = new InstanceElement('issueType2', issueTypes, {
      id: '2',
      name: 'issueType2',
    })
    instance = new InstanceElement('instance', scriptedFields, {
      issueTypes: [
        new ReferenceExpression(issueType1.elemID, issueType1),
        new ReferenceExpression(issueType2.elemID, issueType2),
      ],
    })
  })
  describe('when script runner is enabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = true
      filter = scriptedFieldsIssueTypeFilter(getFilterParams({ config })) as FilterType
    })
    it('should add issueTypeIds on preDeploy', async () => {
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.issueTypeIds).toEqual(['1', '2'])
    })
    it('should remove issueTypeIdson onDeploy', async () => {
      instance.value.issueTypes = ['issueType1', 'issueType2']
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.issueTypeIds).toBeUndefined()
    })
  })
  describe('when script runner is disabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = false
      filter = scriptedFieldsIssueTypeFilter(getFilterParams({ config })) as FilterType
    })
    it('should not add issueTypeIds on preDeploy when disabled', async () => {
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.issueTypeIds).toBeUndefined()
    })
    it('should not remove issueTypeNames on onDeploy when disabled', async () => {
      instance.value.issueTypeIds = ['1', '2']
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.issueTypeIds).toEqual(['1', '2'])
    })
  })
})
