/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ZENDESK, LOCALE_TYPE_NAME } from '../../src/constants'
import { localeModificationValidator } from '../../src/change_validators/locale'

describe('locale', () => {
  const localeType = new ObjectType({ elemID: new ElemID(ZENDESK, LOCALE_TYPE_NAME) })
  const enUsLocaleInstance = new InstanceElement('en US', localeType, {
    locale: 'en-US',
    id: 1,
  })
  it('should return an error when there is a modification change', async () => {
    const errors = await localeModificationValidator([
      toChange({ before: enUsLocaleInstance, after: enUsLocaleInstance }),
    ])
    expect(errors).toEqual([
      {
        elemID: enUsLocaleInstance.elemID,
        severity: 'Error',
        message: 'Modification of locale is not supported',
        detailedMessage: `Failed to update ${enUsLocaleInstance.elemID.getFullName()} since modification of locale is not supported by Zendesk`,
      },
    ])
  })
  it('should not return an error when there is an addition', async () => {
    const errors = await localeModificationValidator([toChange({ after: enUsLocaleInstance })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when there is a removal', async () => {
    const errors = await localeModificationValidator([toChange({ before: enUsLocaleInstance })])
    expect(errors).toHaveLength(0)
  })
})
