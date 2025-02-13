/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils, deployment } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { JIRA } from '../../../src/constants'
import fieldConfigurationDeploymentFilter from '../../../src/filters/field_configuration/field_configuration_deployment'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'
import { getFilterParams, mockClient } from '../../utils'

const { deployChange } = deployment

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('fieldConfigurationDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let fieldConfigurationType: ObjectType
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator, connection } = mockClient()
    mockConnection = connection

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = fieldConfigurationDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter

    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfiguration'),
    })
  })

  describe('deploy', () => {
    const supportedFields = _.range(0, 150).map(i => ({
      id: `supported${i}`,
      description: `description${i}`,
    }))

    let instance: InstanceElement
    let change: Change<InstanceElement>

    beforeEach(async () => {
      ;(deployChange as jest.Mock).mockClear()
      instance = new InstanceElement('instance', fieldConfigurationType, {
        name: 'name',
        id: 1,
        fields: supportedFields,
      })

      const beforeInstance = instance.clone()
      beforeInstance.value.description = 'before'

      change = toChange({ before: beforeInstance, after: instance })
    })

    it('should deploy regular fields using deployChange in modification', async () => {
      await filter.deploy([change])
      expect(deployChange).toHaveBeenCalled()
    })

    it('should deploy regular fields using deployChange in creation', async () => {
      await filter.deploy([toChange({ after: instance })])
      expect(deployChange).toHaveBeenCalled()
    })

    it('should not deploy regular fields if is default and change is modification', async () => {
      instance.value.isDefault = true
      await filter.deploy([change])
      expect(deployChange).not.toHaveBeenCalled()
    })

    it('should deploy supported fields configuration in chunks', async () => {
      await filter.deploy([change])
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfiguration/1/fields',
        {
          fieldConfigurationItems: supportedFields.slice(0, 100),
        },
        undefined,
      )
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfiguration/1/fields',
        {
          fieldConfigurationItems: supportedFields.slice(100, supportedFields.length),
        },
        undefined,
      )
    })

    it('should not deploy fields configuration if empty', async () => {
      delete instance.value.fields
      await filter.deploy([change])
      expect(mockConnection.put).not.toHaveBeenCalledWith()
    })
  })
})
