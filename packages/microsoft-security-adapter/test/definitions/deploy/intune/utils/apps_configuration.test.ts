/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { appsConfiguration } from '../../../../../src/definitions/deploy/intune/utils'
import { contextMock } from '../../../../mocks'
import { APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME } from '../../../../../src/constants/intune'

describe('apps configuration definition utils', () => {
  const applicationConfigurationType = new ObjectType({
    elemID: new ElemID(APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME),
  })
  const appConfigurationWithAllApps = new InstanceElement('test', applicationConfigurationType, {
    targetedManagedAppGroupType: 'allApps',
  })
  const appConfigurationWithSelectedApps = new InstanceElement('test', applicationConfigurationType, {
    targetedManagedAppGroupType: 'selectedPublicApps',
    apps: ['app1', 'app2'],
  })
  const appConfigurationWithSelectedAppsAndNoApps = new InstanceElement('test', applicationConfigurationType, {
    targetedManagedAppGroupType: 'selectedPublicApps',
  })

  describe('targetAppsChangeCondition', () => {
    it('should only contain custom function', () => {
      expect(Object.keys(appsConfiguration.targetAppsChangeCondition)).toEqual(['custom'])
    })

    describe('when the change is a removal change', () => {
      it('should return false', () => {
        expect(
          appsConfiguration.targetAppsChangeCondition.custom?.({})({
            ...contextMock,
            change: toChange({ before: appConfigurationWithSelectedApps }),
          }),
        ).toEqual(false)
      })
    })

    describe('when the change is addition change', () => {
      describe('when targetedManagedAppGroupType is selectedPublicApps', () => {
        it('should return true if the change includes apps field', () => {
          expect(
            appsConfiguration.targetAppsChangeCondition.custom?.({})({
              ...contextMock,
              change: toChange({ after: appConfigurationWithSelectedApps }),
            }),
          ).toEqual(true)
        })

        it('should return false if the change does not include apps field', () => {
          expect(
            appsConfiguration.targetAppsChangeCondition.custom?.({})({
              ...contextMock,
              change: toChange({ after: appConfigurationWithSelectedAppsAndNoApps }),
            }),
          ).toEqual(false)
        })
      })

      describe('when targetedManagedAppGroupType is allApps', () => {
        it('should return false', () => {
          expect(
            appsConfiguration.targetAppsChangeCondition.custom?.({})({
              ...contextMock,
              change: toChange({ after: appConfigurationWithAllApps }),
            }),
          ).toEqual(false)
        })
      })
    })

    describe('when the change is modification change', () => {
      describe('when targetedManagedAppGroupType is selectedPublicApps', () => {
        it('should return true if the apps field was changed', () => {
          expect(
            appsConfiguration.targetAppsChangeCondition.custom?.({})({
              ...contextMock,
              change: toChange({
                before: appConfigurationWithSelectedApps,
                after: appConfigurationWithSelectedAppsAndNoApps,
              }),
            }),
          ).toEqual(true)
        })

        it('should return false if the apps field was not changed', () => {
          expect(
            appsConfiguration.targetAppsChangeCondition.custom?.({})({
              ...contextMock,
              change: toChange({ before: appConfigurationWithSelectedApps, after: appConfigurationWithSelectedApps }),
            }),
          ).toEqual(false)
        })
      })

      describe('when targetedManagedAppGroupType is allApps', () => {
        it('should return false', () => {
          expect(
            appsConfiguration.targetAppsChangeCondition.custom?.({})({
              ...contextMock,
              change: toChange({
                before: appConfigurationWithSelectedApps,
                after: appConfigurationWithAllApps,
              }),
            }),
          ).toEqual(false)
        })
      })
    })
  })

  describe(`${appsConfiguration.toActionNames.name}`, () => {
    describe('when the change is addition change', () => {
      it('should return the action name and targetApps', () => {
        expect(
          appsConfiguration.toActionNames({
            ...contextMock,
            change: toChange({ after: appConfigurationWithSelectedApps }),
          }),
        ).toEqual(['add', 'targetApps'])
      })
    })

    describe('when the change is modification change', () => {
      it('should return the action name and targetApps', () => {
        expect(
          appsConfiguration.toActionNames({
            ...contextMock,
            change: toChange({
              before: appConfigurationWithSelectedApps,
              after: appConfigurationWithSelectedAppsAndNoApps,
            }),
          }),
        ).toEqual(['modify', 'targetApps'])
      })
    })

    describe('when the change is not addition or modification change', () => {
      it('should return the action name', () => {
        expect(
          appsConfiguration.toActionNames({
            ...contextMock,
            change: toChange({ before: appConfigurationWithSelectedApps }),
          }),
        ).toEqual(['remove'])
      })
    })
  })
})
