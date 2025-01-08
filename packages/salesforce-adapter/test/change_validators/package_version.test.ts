/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ElemID, getChangeData, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import changeValidator, {
  TYPES_PACKAGE_VERSION_EXACT_VERSION,
  TYPES_PACKAGE_VERSION_NO_GREATER_VERSION,
} from '../../src/change_validators/package_version'
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
  let requiresExactVersion: boolean
  describe.each([...TYPES_PACKAGE_VERSION_NO_GREATER_VERSION, ...TYPES_PACKAGE_VERSION_EXACT_VERSION])(
    'when the package version in the instance is higher than in the target environment',
    (instanceType: string) => {
      let change: Change
      beforeEach(() => {
        requiresExactVersion = TYPES_PACKAGE_VERSION_EXACT_VERSION.has(instanceType)
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
      it('should return an error for every package that require a version match', async () => {
        const expectedErrorMessage = requiresExactVersion
          ? 'Cannot deploy instances with a package version that does not match the version in the target environment'
          : 'Cannot deploy instances with a package version that is greater than the version in the target environment'
        const errs = await changeValidator([change])
        expect(errs).toHaveLength(2)
        expect(errs[0].message).toEqual(expectedErrorMessage)
        expect(errs[0].elemID).toEqual(getChangeData(change).elemID.createNestedID('packageVersions', '0'))
        expect(errs[1].message).toEqual(expectedErrorMessage)
        expect(errs[1].elemID).toEqual(getChangeData(change).elemID.createNestedID('packageVersions', '1'))
      })
    },
  )

  describe.each(Object.entries([...TYPES_PACKAGE_VERSION_NO_GREATER_VERSION, ...TYPES_PACKAGE_VERSION_EXACT_VERSION]))(
    'when the package version in the instance is lower than in the target environment',
    (instanceType: string) => {
      let change: Change
      beforeEach(() => {
        requiresExactVersion = TYPES_PACKAGE_VERSION_EXACT_VERSION.has(instanceType)
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
      it('should return an error for all packages that require an exact version match', async () => {
        const expectedErrorMessage =
          'Cannot deploy instances with a package version that does not match the version in the target environment'
        const expectedNumOfErrors = requiresExactVersion ? 2 : 0
        const errs = await changeValidator([change])
        expect(errs).toHaveLength(expectedNumOfErrors)
        if (requiresExactVersion) {
          expect(errs[0].message).toEqual(expectedErrorMessage)
          expect(errs[0].elemID).toEqual(getChangeData(change).elemID.createNestedID('packageVersions', '0'))
          expect(errs[1].message).toEqual(expectedErrorMessage)
          expect(errs[1].elemID).toEqual(getChangeData(change).elemID.createNestedID('packageVersions', '1'))
        }
      })
    },
  )

  describe.each(Object.entries([...TYPES_PACKAGE_VERSION_NO_GREATER_VERSION, ...TYPES_PACKAGE_VERSION_EXACT_VERSION]))(
    'when the package version in the instance is equal to version in the target environment',
    (instanceType: string) => {
      let change: Change
      beforeEach(() => {
        requiresExactVersion = TYPES_PACKAGE_VERSION_EXACT_VERSION.has(instanceType)
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
      it('should not return errors', async () => {
        const errs = await changeValidator([change])
        expect(errs).toHaveLength(0)
      })
    },
  )
  describe('When the type of the instance does not require package version matching', () => {
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
    it('should not return any errors', async () => {
      const errs = await changeValidator([change])
      expect(errs).toHaveLength(0)
    })
  })
})
