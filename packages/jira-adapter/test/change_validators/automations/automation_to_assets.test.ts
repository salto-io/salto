/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, toChange, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import _ from 'lodash'
import { automationToAssetsValidator } from '../../../src/change_validators/automation/automation_to_assets'
import { AUTOMATION_TYPE } from '../../../src/constants'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'
import { createEmptyType } from '../../utils'

describe('automationsToAssetsValidator', () => {
  let automationInstance: InstanceElement
  let config: JiraConfig

  beforeEach(() => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = false
    automationInstance = new InstanceElement(
      'automationInstance1',
      createEmptyType(AUTOMATION_TYPE),
      {
        name: 'automationInstance',
        components: [
          {
            component: 'ACTION',
            schemaVersion: 1,
            type: 'cmdb.lookup.objects',
            value: {
              workspaceId: 'workspaceId',
              schemaId: 'schemaId',
            },
          },
        ],
      },
      undefined,
      {
        [CORE_ANNOTATIONS.ALIAS]: ['automation alias'],
      },
    )
  })

  it('should return a warning when its addition change and automation has workspaceId and enableJSM is false', async () => {
    const validator = automationToAssetsValidator(config)
    expect(await validator([toChange({ after: automationInstance })])).toEqual([
      {
        elemID: automationInstance.elemID,
        severity: 'Warning',
        message: 'Missing Assets support for Automation Linked to Assets Elements.',
        detailedMessage:
          "The automation 'automation alias', linked to the Assets object, requires the Assets support in Salto. This automation currently uses internal IDs but does not have the Assets support. If you have modified internal IDs, ensure they are accurate in the target environment. Incorrect IDs, without the Assets support, could lead to deployment issues.",
      },
    ])
  })
  it('should not return a warning when its addition change and automation has workspaceId and enableJSM is true', async () => {
    config.fetch.enableJSM = true
    config.fetch.enableJSMPremium = true
    const validator = automationToAssetsValidator(config)
    expect(await validator([toChange({ after: automationInstance })])).toEqual([])
  })
  it('should not return a warning when automation does not have workspaceId or schemaId and enableJSM is false', async () => {
    automationInstance.value.components[0].value.workspaceId = undefined
    automationInstance.value.components[0].value.schemaId = undefined
    const validator = automationToAssetsValidator(config)
    expect(await validator([toChange({ after: automationInstance })])).toEqual([])
  })
  it('should return a warning when its modification change and schemaId has changed and enableJSM is false', async () => {
    const automationInstnaceAfter = automationInstance.clone()
    automationInstnaceAfter.value.components[0].value.schemaId = 'newSchemaId'
    const validator = automationToAssetsValidator(config)
    expect(await validator([toChange({ before: automationInstance, after: automationInstnaceAfter })])).toEqual([
      {
        elemID: automationInstance.elemID,
        severity: 'Warning',
        message: 'Missing Assets support for Automation Linked to Assets Elements.',
        detailedMessage:
          "The automation 'automation alias', linked to the Assets object, requires the Assets support in Salto. This automation currently uses internal IDs but does not have the Assets support. If you have modified internal IDs, ensure they are accurate in the target environment. Incorrect IDs, without the Assets support, could lead to deployment issues.",
      },
    ])
  })
  it('should not return a warning when its modification change and no internalId has changed and enableJSM is false', async () => {
    const automationInstnaceAfter = automationInstance.clone()
    automationInstnaceAfter.value.name = 'newNameId'
    const validator = automationToAssetsValidator(config)
    expect(await validator([toChange({ before: automationInstance, after: automationInstnaceAfter })])).toEqual([])
  })
  it('should not return a warning when adding another component with the same workspaceId and enableJSM is false', async () => {
    const automationInstnaceAfter = automationInstance.clone()
    automationInstnaceAfter.value.components.push({
      component: 'BRANCH',
      schemaVersion: 2,
      type: 'cmdb.object.related',
      value: {
        workspaceId: 'workspaceId',
        schemaId: 'schemaId',
      },
    })
    const validator = automationToAssetsValidator(config)
    expect(await validator([toChange({ before: automationInstance, after: automationInstnaceAfter })])).toEqual([])
  })
  it('should not return a warning when value is undefined in addition change and enableJSM is false', async () => {
    const automationInstnaceAfter = automationInstance.clone()
    automationInstnaceAfter.value.components[0].value = undefined
    const validator = automationToAssetsValidator(config)
    expect(await validator([toChange({ after: automationInstnaceAfter })])).toEqual([])
  })
})
