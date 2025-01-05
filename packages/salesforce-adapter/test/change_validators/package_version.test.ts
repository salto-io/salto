/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, ElemID, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import changeValidator, { TYPES_TO_IS_DEMANDING_EXACT_VERSION, Def } from '../../src/change_validators/package_version'
import { ACCOUNT_SETTINGS_METADATA_TYPE } from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType } from '../utils'

describe('when deploying objects with installed packages', () => {
  const sbqq = new ReferenceExpression(
    new ElemID('salesforce'),
    new InstanceElement('SBQQ', mockTypes.InstalledPackage, {
      versionNumber: '248.1',
      fullName: 'SBQQ',
      _alias: 'SBQQ',
    }),
  )
  const sbaa = new ReferenceExpression(
    new ElemID('salesforce'),
    new InstanceElement('SBQQ', mockTypes.InstalledPackage, {
      versionNumber: '244.0',
      fullName: 'sbaa',
      _alias: 'sbaa',
    }),
  )
  const fakePackage = { resValue: { value: {} } }
  let demandsExactVersion: boolean
  describe.each(Array.from([...TYPES_TO_IS_DEMANDING_EXACT_VERSION]))(
    'when package version at instance is higher than at target environment',
    (instanceType: string, exactVersion: Def) => {
      let change: Change
      beforeEach(() => {
        demandsExactVersion = exactVersion.exactVersion
        const objectTypeToValidate = createCustomObjectType(instanceType, {
          elemID: new ElemID('salesforce', instanceType),
        })
        const instance = new InstanceElement('asd', objectTypeToValidate, {
          packageVersions: [
            {
              majorNumber: 249,
              minorNumber: 1,
              namespace: sbqq,
            },
            {
              majorNumber: 244,
              minorNumber: 1,
              namespace: sbaa,
            },
            {
              majorNumber: 1,
              minorNumber: 7,
              namespace: fakePackage,
            },
          ],
        })
        change = toChange({ after: instance })
      })
      it('should not deploy instance', async () => {
        const expectedErrorMessage = demandsExactVersion
          ? "Cannot deploy instances with different package version than target environment's package version"
          : "Cannot deploy instances with greater package version than target environment's package version"
        const errs = await changeValidator([change])
        expect(errs).toHaveLength(2)
        expect(errs[0].message).toEqual(expectedErrorMessage)
        expect(errs[1].message).toEqual(expectedErrorMessage)
      })
    },
  )

  describe.each(Array.from([...TYPES_TO_IS_DEMANDING_EXACT_VERSION]))(
    'when package version at instance is lower than at target environment',
    (instanceType: string, exactVersion: Def) => {
      let change: Change
      beforeEach(() => {
        demandsExactVersion = exactVersion.exactVersion
        const objectTypeToValidate = createCustomObjectType(instanceType, {
          elemID: new ElemID('salesforce', instanceType),
        })
        const instance = new InstanceElement('asd', objectTypeToValidate, {
          packageVersions: [
            {
              majorNumber: 248,
              minorNumber: 0,
              namespace: sbqq,
            },
            {
              majorNumber: 220,
              minorNumber: 17,
              namespace: sbaa,
            },
            {
              majorNumber: 1,
              minorNumber: 7,
              namespace: fakePackage,
            },
          ],
        })
        change = toChange({ after: instance })
      })
      it('should deploy instance that dont demand exact version', async () => {
        const expectedErrorMessage =
          "Cannot deploy instances with different package version than target environment's package version"
        const expectedNumOfErrors = demandsExactVersion ? 2 : 0
        const errs = await changeValidator([change])
        expect(errs).toHaveLength(expectedNumOfErrors)
        if (demandsExactVersion) {
          expect(errs[0].message).toEqual(expectedErrorMessage)
          expect(errs[1].message).toEqual(expectedErrorMessage)
        }
      })
    },
  )

  describe.each(Array.from([...TYPES_TO_IS_DEMANDING_EXACT_VERSION]))(
    'when package version at instance is equal to version at target environment',
    (instanceType: string, exactVersion: Def) => {
      let change: Change
      beforeEach(() => {
        demandsExactVersion = exactVersion.exactVersion
        const objectTypeToValidate = createCustomObjectType(instanceType, {
          elemID: new ElemID('salesforce', instanceType),
        })
        const instance = new InstanceElement('asd', objectTypeToValidate, {
          packageVersions: [
            {
              majorNumber: 248,
              minorNumber: 1,
              namespace: sbqq,
            },
            {
              majorNumber: 244,
              minorNumber: 0,
              namespace: sbaa,
            },
            {
              majorNumber: 1,
              minorNumber: 7,
              namespace: fakePackage,
            },
          ],
        })
        change = toChange({ after: instance })
      })
      it('should deploy instance', async () => {
        const errs = await changeValidator([change])
        expect(errs).toHaveLength(0)
      })
    },
  )
  describe('when type of instance is not in the list', () => {
    const objectTypeNotInTheList = createCustomObjectType(ACCOUNT_SETTINGS_METADATA_TYPE, {
      elemID: new ElemID('salesforce', ACCOUNT_SETTINGS_METADATA_TYPE),
    })
    const instance = new InstanceElement('asd', objectTypeNotInTheList, {
      packageVersions: [
        {
          majorNumber: 290,
          minorNumber: 1,
          namespace: sbqq,
        },
        {
          majorNumber: 23,
          minorNumber: 1,
          namespace: sbaa,
        },
        {
          majorNumber: 1,
          minorNumber: 7,
          namespace: fakePackage,
        },
      ],
    })
    const change = toChange({ after: instance })
    it('should not be caught', async () => {
      const errs = await changeValidator([change])
      expect(errs).toHaveLength(0)
    })
  })
})
