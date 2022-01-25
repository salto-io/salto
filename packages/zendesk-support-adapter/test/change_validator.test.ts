/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../src/config'
import createChangeValidator from '../src/change_validator'
import { ZENDESK_SUPPORT } from '../src/constants'

describe('change validator creator', () => {
  describe('deployNotSupportedValidator', () => {
    it('should not fail if there are no deploy changes', async () => {
      expect(await createChangeValidator(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])([]))
        .toEqual([])
    })

    it('should fail each change individually', async () => {
      expect(await createChangeValidator(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])([
        toChange({ after: new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'obj') }) }),
        toChange({ before: new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'obj2') }) }),
      ])).toEqual([
        {
          elemID: new ElemID(ZENDESK_SUPPORT, 'obj'),
          severity: 'Error',
          message: 'Deployment of non-instance elements is not supported in adapter zendesk_support',
          detailedMessage: 'Deployment of zendesk_support.obj is not supported',
        },
        {
          elemID: new ElemID(ZENDESK_SUPPORT, 'obj2'),
          severity: 'Error',
          message: 'Deployment of non-instance elements is not supported in adapter zendesk_support',
          detailedMessage: 'Deployment of zendesk_support.obj2 is not supported',
        },
      ])
    })
  })
  describe('checkDeploymentBasedOnConfigValidator', () => {
    it('should fail each change individually', async () => {
      const type = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'obj') })
      expect(await createChangeValidator(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])([
        toChange({ after: new InstanceElement('inst1', type) }),
        toChange({ before: new InstanceElement('inst2', type) }),
      ])).toEqual([
        {
          elemID: new ElemID(ZENDESK_SUPPORT, 'obj', 'instance', 'inst1'),
          severity: 'Error',
          message: 'Operation not supported',
          detailedMessage: 'Salto does not support "add" of zendesk_support.obj.instance.inst1',
        },
        {
          elemID: new ElemID(ZENDESK_SUPPORT, 'obj', 'instance', 'inst2'),
          severity: 'Error',
          message: 'Operation not supported',
          detailedMessage: 'Salto does not support "remove" of zendesk_support.obj.instance.inst2',
        },
      ])
    })
  })
})
