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

import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { createInstanceElement } from '../../src/transformers/transformer'
import changeValidator from '../../src/change_validators/changed_at_version'
import {
  ArtificialTypes,
  CHANGED_AT_SINGLETON,
  CHANGED_AT_SINGLETON_VERSION_FIELD,
  CHANGED_AT_VERSION,
  SALESFORCE,
} from '../../src/constants'

describe('Changed at version validator', () => {
  const mockElementsSource = (
    changedAtVersion: number,
  ): ReadOnlyElementsSource => {
    const changedAtSingleton = createInstanceElement(
      {
        fullName: 'whatever',
        [CHANGED_AT_SINGLETON_VERSION_FIELD]: changedAtVersion,
      },
      ArtificialTypes[CHANGED_AT_SINGLETON],
    )
    return buildElementsSourceFromElements([changedAtSingleton])
  }

  describe('when the changed at version is up to date', () => {
    const elementsSource = mockElementsSource(CHANGED_AT_VERSION)

    it('should pass validation', async () => {
      const errors = await changeValidator([], elementsSource)
      expect(errors).toBeEmpty()
    })
  })

  describe('when the changed at version is outdated', () => {
    const elementsSource = mockElementsSource(CHANGED_AT_VERSION - 1)

    it('should fail validation', async () => {
      const errors = await changeValidator([], elementsSource)
      expect(errors).toEqual([
        {
          elemID: new ElemID(SALESFORCE),
          severity: 'Error',
          message:
            'There have been major changes to the adapter, please fetch before deploying',
          detailedMessage:
            'There have been major changes to the Salesforce adapter since the last time data was fetched for the environment. This may create problems with the deployment. Please fetch the environment and refresh the deployment before deploying.',
        },
      ])
    })
  })

  describe('when the changed at singleton is missing', () => {
    const elementsSource = buildElementsSourceFromElements([])

    it('should pass validation', async () => {
      const errors = await changeValidator([], elementsSource)
      // This is only the case so long as CHANGED_AT_VERSION is 0.
      // Once we bump we should expect this to fail.
      expect(errors).toBeEmpty()
    })
  })
})
