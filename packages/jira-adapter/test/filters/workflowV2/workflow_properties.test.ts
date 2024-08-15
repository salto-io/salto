/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ReferenceExpression, toChange, Value } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FilterResult } from '../../../src/filter'
import statusPropertiesReferencesFilter from '../../../src/filters/workflowV2/status_properties_references'
import { createEmptyType, getFilterParams } from '../../utils'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { getDefaultConfig } from '../../../src/config/config'
import { getRefType } from '../../../src/references/workflow_properties'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('status properties references filter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy', FilterResult>
  let instance: InstanceElement
  let instanceBody: Value
  beforeEach(() => {
    filter = statusPropertiesReferencesFilter(getFilterParams()) as filterUtils.FilterWith<
      'onFetch' | 'preDeploy' | 'onDeploy',
      FilterResult
    >
    instanceBody = {
      name: 'name',
      scope: {
        type: 'global',
      },
      statuses: [
        {
          name: 'status1',
          properties: [
            {
              key: 'approval.transition.approved',
              value: '2',
            },
            {
              key: 'approval.transition.rejected',
              value: '1',
            },
          ],
        },
        {
          name: 'status2',
          properties: [
            {
              key: 'approval.transition.approved',
              value: '3',
            },
            {
              key: 'approval.transition.rejected',
              value: '2',
            },
          ],
        },
      ],
      transitions: {
        transition1: {
          type: 'DIRECTED',
          name: 'transition1',
          id: '1',
        },
        transition2: {
          type: 'DIRECTED',
          name: 'transition2',
          id: '2',
        },
        transition3: {
          type: 'DIRECTED',
          name: 'transition3',
          id: '3',
        },
      },
    }
    instance = new InstanceElement('instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), instanceBody)
  })
  describe('on fetch', () => {
    it('should replace transition ids with references', async () => {
      await filter.onFetch([instance])
      expect(instance.value.statuses[0].properties[0].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition2'),
          instance.value.transitions.transition2,
        ),
      )
      expect(instance.value.statuses[0].properties[1].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition1'),
          instance.value.transitions.transition1,
        ),
      )
      expect(instance.value.statuses[1].properties[0].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition3'),
          instance.value.transitions.transition3,
        ),
      )
      expect(instance.value.statuses[1].properties[1].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition2'),
          instance.value.transitions.transition2,
        ),
      )
    })
    it('should not replace non transition ids', async () => {
      instance.value.statuses[0].properties[0].value = 'invalid'
      await filter.onFetch([instance])
      expect(instance.value.statuses[0].properties[0].value).toEqual(
        new ReferenceExpression(instance.elemID.createNestedID('transitions', 'missing_invalid')),
      )
    })
    it('should not replace non transition keys', async () => {
      instance.value.statuses[0].properties[0].key = 'invalid'
      await filter.onFetch([instance])
      expect(instance.value.statuses[0].properties[0].value).toEqual('2')
    })
    it('should not create missing references if disabled', async () => {
      instance.value.statuses[0].properties[0].value = 'invalid'
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      config.fetch.enableMissingReferences = false
      filter = statusPropertiesReferencesFilter(getFilterParams({ config })) as filterUtils.FilterWith<
        'onFetch' | 'preDeploy' | 'onDeploy',
        FilterResult
      >
      await filter.onFetch([instance])
      expect(instance.value.statuses[0].properties[0].value).toEqual('invalid')
    })
    it('should not create missing references if config value does not exist', async () => {
      instance.value.statuses[0].properties[0].value = 'invalid'
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      delete config.fetch.enableMissingReferences
      filter = statusPropertiesReferencesFilter(getFilterParams({ config })) as filterUtils.FilterWith<
        'onFetch' | 'preDeploy' | 'onDeploy',
        FilterResult
      >
      await filter.onFetch([instance])
      expect(instance.value.statuses[0].properties[0].value).toEqual(
        new ReferenceExpression(instance.elemID.createNestedID('transitions', 'missing_invalid')),
      )
    })
    it('should not crash if there are no properties', async () => {
      delete instance.value.statuses[0].properties
      await filter.onFetch([instance])
      expect(instance.value.statuses[0].properties).toBeUndefined()
    })
    it('should not crash if there are no statuses', async () => {
      delete instance.value.statuses
      await filter.onFetch([instance])
      expect(instance.value.statuses).toBeUndefined()
    })
    it('should not run on workflow v1', async () => {
      instance = new InstanceElement('instance', createEmptyType(WORKFLOW_TYPE_NAME), instanceBody)
      await filter.onFetch([instance])
      expect(instance.value.statuses[0].properties[0].value).toEqual('2')
    })
  })
  describe('pre deploy', () => {
    beforeEach(() => {
      instance.value.statuses[0].properties[0].value = new ReferenceExpression(
        instance.elemID.createNestedID('transitions', 'transition2'),
      )
      instance.value.statuses[0].properties[1].value = new ReferenceExpression(
        instance.elemID.createNestedID('transitions', 'transition1'),
      )
      instance.value.statuses[1].properties[0].value = new ReferenceExpression(
        instance.elemID.createNestedID('transitions', 'transition3'),
      )
      instance.value.statuses[1].properties[1].value = new ReferenceExpression(
        instance.elemID.createNestedID('transitions', 'transition2'),
      )
    })
    it('should replace with references with transitionIds for addition', async () => {
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.statuses[0].properties[0].value).toEqual('2')
      expect(instance.value.statuses[0].properties[1].value).toEqual('1')
      expect(instance.value.statuses[1].properties[0].value).toEqual('3')
      expect(instance.value.statuses[1].properties[1].value).toEqual('2')
    })
    it('should replace with references with transitionIds for modification', async () => {
      const instanceBefore = instance.clone()
      instanceBefore.value.statuses[0].properties[0].value = new ReferenceExpression(
        instance.elemID.createNestedID('transitions', 'transition1'),
      )
      await filter.preDeploy([toChange({ before: instanceBefore, after: instance })])
      expect(instance.value.statuses[0].properties[0].value).toEqual('2')
    })
    it('should not replace in removal', async () => {
      await filter.preDeploy([toChange({ before: instance })])
      expect(instance.value.statuses[0].properties[0].value).toEqual(
        new ReferenceExpression(instance.elemID.createNestedID('transitions', 'transition2')),
      )
    })
    it('should not replace non reference values', async () => {
      instance.value.statuses[0].properties[0].value = 'invalid'
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.statuses[0].properties[0].value).toEqual('invalid')
    })
    it('should not replace non transition keys', async () => {
      instance.value.statuses[0].properties[0].key = 'invalid'
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.statuses[0].properties[0].value).toEqual(
        new ReferenceExpression(instance.elemID.createNestedID('transitions', 'transition2')),
      )
    })
    it('should not crash if there are no properties', async () => {
      delete instance.value.statuses[0].properties
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.statuses[0].properties).toBeUndefined()
    })
    it('should not crash if there are no statuses', async () => {
      delete instance.value.statuses
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.statuses).toBeUndefined()
    })
    it('should not run on workflow v1', async () => {
      const oldInstanceElemID = instance.elemID
      instance = new InstanceElement('instance', createEmptyType(WORKFLOW_TYPE_NAME), instanceBody)
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.statuses[0].properties[0].value).toEqual(
        new ReferenceExpression(oldInstanceElemID.createNestedID('transitions', 'transition2')),
      )
    })
  })
  describe('on deploy', () => {
    it('should replace references with transitionIds for addition', async () => {
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.statuses[0].properties[0].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition2'),
          instance.value.transitions.transition2,
        ),
      )
      expect(instance.value.statuses[0].properties[1].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition1'),
          instance.value.transitions.transition1,
        ),
      )
      expect(instance.value.statuses[1].properties[0].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition3'),
          instance.value.transitions.transition3,
        ),
      )
      expect(instance.value.statuses[1].properties[1].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition2'),
          instance.value.transitions.transition2,
        ),
      )
    })
    it('should replace references with transitionIds for modification', async () => {
      const instanceBefore = instance.clone()
      instanceBefore.value.statuses[0].properties[0].value = new ReferenceExpression(
        instance.elemID.createNestedID('transitions', 'transition1'),
      )
      await filter.onDeploy([toChange({ before: instanceBefore, after: instance })])
      expect(instance.value.statuses[0].properties[0].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition2'),
          instance.value.transitions.transition2,
        ),
      )
      expect(instance.value.statuses[0].properties[1].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition1'),
          instance.value.transitions.transition1,
        ),
      )
      expect(instance.value.statuses[1].properties[0].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition3'),
          instance.value.transitions.transition3,
        ),
      )
      expect(instance.value.statuses[1].properties[1].value).toEqual(
        new ReferenceExpression(
          instance.elemID.createNestedID('transitions', 'transition2'),
          instance.value.transitions.transition2,
        ),
      )
    })
    it('should not crash if no properties', () => {
      delete instance.value.statuses[0].properties
      expect(() => filter.onDeploy([toChange({ after: instance })])).not.toThrow()
    })
  })
})

describe('workflow properties  filter', () => {
  it('should not fail', () => {
    expect(getRefType('approval.field.id')).toEqual(FIELD_TYPE_NAME)
    expect(getRefType('none')).toBeUndefined()
  })
})
