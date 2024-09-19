/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { DeployRequestCondition } from '@salto-io/adapter-components/src/definitions/system/deploy'
import { targetApps } from '../../../../../src/definitions/deploy/intune/utils'
import { contextMock } from '../../../../mocks'
import { APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME } from '../../../../../src/constants/intune'
import { AdjustFunction } from '../../../../../src/definitions/deploy/shared/types'

describe('apps configuration definition utils', () => {
  const applicationConfigurationType = new ObjectType({
    elemID: new ElemID(APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME),
  })
  const appConfigurationWithAllApps = new InstanceElement('test', applicationConfigurationType, {
    targetTypeField: 'allApps',
    apps: [],
  })
  const appConfigurationWithSelectedApps = new InstanceElement('test', applicationConfigurationType, {
    targetTypeField: 'selectedPublicApps',
    apps: ['app1', 'app2'],
  })
  const appConfigurationWithSelectedAppsAndNoApps = new InstanceElement('test', applicationConfigurationType, {
    targetTypeField: 'selectedPublicApps',
    apps: [],
  })

  describe(`${targetApps.createTargetAppsDeployDefinition.name}`, () => {
    it('should return the correct deploy definition', () => {
      const deployDefinition = targetApps.createTargetAppsDeployDefinition({
        resourcePath: '/test',
        targetTypeFieldName: 'targetTypeField',
      })
      expect(deployDefinition).toEqual({
        request: {
          endpoint: {
            path: '/test/{id}/targetApps',
            method: 'post',
          },
          transformation: {
            adjust: expect.any(Function),
          },
        },
        condition: {
          custom: expect.any(Function),
        },
      })
    })

    describe('condition', () => {
      let condition: DeployRequestCondition | undefined
      beforeEach(() => {
        ;({ condition } = targetApps.createTargetAppsDeployDefinition({
          resourcePath: '/test',
          targetTypeFieldName: 'targetTypeField',
        }))
      })

      it('should only contain custom function', () => {
        expect(Object.keys(condition ?? {})).toEqual(['custom'])
      })

      describe('when the change is a removal change', () => {
        it('should return false', () => {
          expect(
            condition?.custom?.({})({
              ...contextMock,
              change: toChange({ before: appConfigurationWithSelectedApps }),
            }),
          ).toEqual(false)
        })
      })

      describe('when targetTypeField was changed', () => {
        it('should return true if the change includes apps field', () => {
          expect(
            condition?.custom?.({})({
              ...contextMock,
              change: toChange({
                before: appConfigurationWithAllApps,
                after: appConfigurationWithSelectedAppsAndNoApps,
              }),
            }),
          ).toEqual(true)
        })
      })

      describe('when apps field was changed', () => {
        it('should return true', () => {
          expect(
            condition?.custom?.({})({
              ...contextMock,
              change: toChange({
                before: appConfigurationWithSelectedAppsAndNoApps,
                after: appConfigurationWithSelectedApps,
              }),
            }),
          ).toEqual(true)
        })
      })

      describe('when both targetTypeField and apps field were not changed', () => {
        it('should return false', () => {
          expect(
            condition?.custom?.({})({
              ...contextMock,
              change: toChange({
                before: appConfigurationWithAllApps,
                after: appConfigurationWithAllApps,
              }),
            }),
          ).toEqual(false)
        })
      })
    })

    describe('adjust', () => {
      let adjust: AdjustFunction | undefined
      beforeEach(() => {
        adjust = targetApps.createTargetAppsDeployDefinition({
          resourcePath: '/test',
          targetTypeFieldName: 'targetTypeField',
        }).request?.transformation?.adjust
      })

      it('should return a value with the apps field and targetTypeField', async () => {
        const value = await adjust?.({
          value: appConfigurationWithSelectedApps.value,
          typeName: APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
          context: contextMock,
        })
        expect(value).toEqual({
          value: {
            apps: ['app1', 'app2'],
            appGroupType: 'selectedPublicApps',
          },
        })
      })
    })
  })
})
