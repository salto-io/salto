/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID } from '@salto-io/adapter-api'
import { mockClient } from '../utils'
import changeValidator from '../../src/change_validators'
import { JIRA } from '../../src/constants'
import { getDefaultConfig } from '../../src/config/config'
import { GQL_BASE_URL_GATEWAY, GQL_BASE_URL_GIRA } from '../../src/client/client'

const { client, paginator, connection } = mockClient()

describe('change validator creator', () => {
  beforeEach(async () => {
    connection.get.mockImplementation(async (url: string) => {
      if (url === '/_edge/tenant_info') {
        return {
          status: 200,
          data: { cloudId: '128baddc-c238-4857-b249-cfc84bd10c4b' },
        }
      }

      return { status: 200, data: '' }
    })

    connection.post.mockImplementation(async (url: string) => {
      if (url === GQL_BASE_URL_GIRA || GQL_BASE_URL_GATEWAY) {
        return {
          status: 200,
          data: { data: '', errors: '' },
        }
      }

      return { status: 200, data: '' }
    })
  })

  describe('checkDeploymentAnnotationsValidator', () => {
    it('should not fail if there are no deploy changes', async () => {
      expect(await changeValidator(client, getDefaultConfig({ isDataCenter: false }), paginator)([])).toEqual([])
    })

    it('should fail each change individually', async () => {
      expect(
        await changeValidator(
          client,
          getDefaultConfig({ isDataCenter: false }),
          paginator,
        )([
          toChange({ after: new ObjectType({ elemID: new ElemID(JIRA, 'obj') }) }),
          toChange({ before: new ObjectType({ elemID: new ElemID(JIRA, 'obj2') }) }),
        ]),
      ).toEqual([
        {
          elemID: new ElemID(JIRA, 'obj'),
          severity: 'Error',
          message: 'Deployment of non-instance elements is not supported in adapter jira',
          detailedMessage:
            'Deployment of non-instance elements is not supported in adapter jira. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.',
        },
        {
          elemID: new ElemID(JIRA, 'obj2'),
          severity: 'Error',
          message: 'Deployment of non-instance elements is not supported in adapter jira',
          detailedMessage:
            'Deployment of non-instance elements is not supported in adapter jira. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.',
        },
      ])
    })
  })
})
