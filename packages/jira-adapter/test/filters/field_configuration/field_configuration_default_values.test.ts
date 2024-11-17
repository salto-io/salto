/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../../src/constants'
import fieldConfigurationDefaultValues from '../../../src/filters/field_configuration/field_configuration_default_values'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

import { createEmptyType, getFilterParams } from '../../utils'

describe('fieldConfigurationDefaultValues', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement
  let config: JiraConfig

  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.removeFieldConfigurationDefaultValues = true

    instance = new InstanceElement('instance', createEmptyType(FIELD_CONFIGURATION_TYPE_NAME), {
      fields: [
        {
          id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance1'), {
            value: {
              description: 'same description',
            },
          }),
          description: 'same description',
          isRequired: false,
          isHidden: false,
        },
        {
          id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance2'), {
            value: {
              description: 'different description',
            },
          }),
          description: 'bla bla',
          isRequired: true,
          isHidden: true,
        },
      ],
    })
    filter = fieldConfigurationDefaultValues(
      getFilterParams({
        config,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should remove default values', async () => {
      await filter.onFetch?.([instance])
      expect(instance.value.fields[0]).toEqual({
        id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance1'), {
          value: {
            description: 'same description',
          },
        }),
      })
    })

    it('should not remove non-default values', async () => {
      await filter.onFetch?.([instance])
      expect(instance.value.fields[1]).toEqual({
        id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance2'), {
          value: {
            description: 'different description',
          },
        }),
        description: 'bla bla',
        isRequired: true,
        isHidden: true,
      })
    })

    it('should do nothing if removeFieldConfigurationDefaultValues is false', async () => {
      config.fetch.removeFieldConfigurationDefaultValues = false
      await filter.onFetch?.([instance])
      expect(instance.value.fields).toEqual([
        {
          id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance1'), {
            value: {
              description: 'same description',
            },
          }),
          description: 'same description',
          isRequired: false,
          isHidden: false,
        },
        {
          id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance2'), {
            value: {
              description: 'different description',
            },
          }),
          description: 'bla bla',
          isRequired: true,
          isHidden: true,
        },
      ])
    })
  })
  describe('preDeploy', () => {
    it('should add default values', async () => {
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields[0]).toEqual({
        id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance1'), {
          value: {
            description: 'same description',
          },
        }),
        description: 'same description',
        isRequired: false,
        isHidden: false,
      })
    })

    it('should do nothing when values are already set', async () => {
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields[1]).toEqual({
        id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance2'), {
          value: {
            description: 'different description',
          },
        }),
        description: 'bla bla',
        isRequired: true,
        isHidden: true,
      })
    })

    it('should do nothing if removeFieldConfigurationDefaultValues is false', async () => {
      config.fetch.removeFieldConfigurationDefaultValues = false
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toEqual([
        {
          id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance1'), {
            value: {
              description: 'same description',
            },
          }),
          description: 'same description',
          isRequired: false,
          isHidden: false,
        },
        {
          id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance2'), {
            value: {
              description: 'different description',
            },
          }),
          description: 'bla bla',
          isRequired: true,
          isHidden: true,
        },
      ])
    })
  })

  describe('onDeploy', () => {
    it('should remove default values', async () => {
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields[0]).toEqual({
        id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance1'), {
          value: {
            description: 'same description',
          },
        }),
      })
    })
    it('should not remove non-default values', async () => {
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields[1]).toEqual({
        id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance2'), {
          value: {
            description: 'different description',
          },
        }),
        description: 'bla bla',
        isRequired: true,
        isHidden: true,
      })
    })
  })
})
