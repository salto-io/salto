/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { privateApiValidator } from '../../src/change_validators/private_api'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

describe('privateApiValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) })
    instance = new InstanceElement('instance', type)
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  })
  it('should return an error if privateAPI is disabled', async () => {
    config.client.usePrivateAPI = false
    expect(
      await privateApiValidator(config)([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Deploying this element requires Jira Private API',
        detailedMessage:
          'To deploy this element, private Jira API usage must be enabled. Enable it by setting the jira.client.usePrivateAPI flag to “true” in your Jira environment configuration.',
      },
    ])
  })

  it('should not return an error if privateAPI is enabled', async () => {
    config.client.usePrivateAPI = true

    expect(
      await privateApiValidator(config)([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })
})
