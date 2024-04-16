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

import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ORGANIZATION_SETTINGS, SALESFORCE } from '../../src/constants'
import { LATEST_SUPPORTED_API_VERSION_FIELD } from '../../src/filters/organization_settings'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import elementApiVersionValidator from '../../src/change_validators/element_api_version'

describe('Element API version Change Validator', () => {
  let elementSource: ReadOnlyElementsSource

  const flowWithApiVersion = (apiVersion: number): InstanceElement =>
    createInstanceElement({ fullName: 'flow1', apiVersion }, mockTypes.Flow)

  beforeEach(() => {
    elementSource = buildElementsSourceFromElements([
      new InstanceElement(
        ElemID.CONFIG_NAME,
        new ObjectType({
          elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS),
        }),
        {
          [LATEST_SUPPORTED_API_VERSION_FIELD]: 50,
        },
      ),
    ])
  })

  it('should return no errors for valid elements', async () => {
    const change = toChange({
      before: flowWithApiVersion(40),
      after: flowWithApiVersion(50),
    })
    const errors = await elementApiVersionValidator([change], elementSource)
    expect(errors).toBeEmpty()
  })

  it('should return an error with unsupported API version', async () => {
    const flow = flowWithApiVersion(51)
    const change = toChange({
      after: flow,
    })
    const errors = await elementApiVersionValidator([change], elementSource)
    expect(errors).toEqual([
      expect.objectContaining({
        elemID: flow.elemID,
        severity: 'Error',
        detailedMessage:
          expect.stringContaining('50') && expect.stringContaining('51'),
      }),
    ])
  })

  it('should return no errors for missing elements source', async () => {
    const change = toChange({
      after: flowWithApiVersion(51),
    })
    const errors = await elementApiVersionValidator([change])
    expect(errors).toBeEmpty()
  })

  it('should return no errors when organization settings are missing', async () => {
    const change = toChange({
      after: flowWithApiVersion(51),
    })
    const errors = await elementApiVersionValidator(
      [change],
      buildElementsSourceFromElements([]),
    )
    expect(errors).toBeEmpty()
  })
  it('should return no errors when latest API version is missing from the Organization Settings instance', async () => {
    const change = toChange({
      after: flowWithApiVersion(51),
    })
    const errors = await elementApiVersionValidator(
      [change],
      buildElementsSourceFromElements([
        new InstanceElement(
          ElemID.CONFIG_NAME,
          new ObjectType({
            elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS),
          }),
          {},
        ),
      ]),
    )
    expect(errors).toBeEmpty()
  })
})
