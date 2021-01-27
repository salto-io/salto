/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { PACKAGES_INSTANCES_REGEX } from '../src/types'


describe('packages instances regex', () => {
  const packagesInstanceRegex = new RegExp(PACKAGES_INSTANCES_REGEX)
  it('should match packages instances', () => {
    expect(packagesInstanceRegex.test('ApexClass.AVSFQB__cDBSyncUtilTest')).toBeTruthy()
    expect(packagesInstanceRegex.test('ApexClass.AVSFQB__DBSyncUtilTest__c')).toBeTruthy()
    expect(packagesInstanceRegex.test('ApexClass.AVSFQB__c__c')).toBeTruthy()
    expect(packagesInstanceRegex.test('Layout.MyPacakge__Feed_Sales_Layout')).toBeTruthy()
  })

  it('should not match non-packages instances', () => {
    expect(packagesInstanceRegex.test('Role.InstallationRepairServices')).toBeFalsy()
    expect(packagesInstanceRegex.test('CustomObject.testObj3__c')).toBeFalsy()
    expect(packagesInstanceRegex.test('CustomObjectTranslation.testObj3__c-en_US')).toBeFalsy()
    expect(packagesInstanceRegex.test('CustomObject.testMeta__mdt')).toBeFalsy()
    expect(packagesInstanceRegex.test('CustomObject.testObj3__latitude__s')).toBeFalsy()
    expect(packagesInstanceRegex.test('ApexClass.standard__aaa')).toBeFalsy()
  })
})
