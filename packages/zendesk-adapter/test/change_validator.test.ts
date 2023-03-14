/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG, DEPLOY_CONFIG, FETCH_CONFIG } from '../src/config'
import createChangeValidator from '../src/change_validator'
import { ZENDESK } from '../src/constants'
import ZendeskClient from '../src/client/client'

describe('change validator creator', () => {
  const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
  describe('deployNotSupportedValidator', () => {
    it('should not fail if there are no deploy changes', async () => {
      expect(await createChangeValidator({
        client,
        apiConfig: DEFAULT_CONFIG[API_DEFINITIONS_CONFIG],
        fetchConfig: DEFAULT_CONFIG[FETCH_CONFIG],
        deployConfig: DEFAULT_CONFIG[DEPLOY_CONFIG],
        typesDeployedViaParent: [],
        typesWithNoDeploy: [],
      })([]))
        .toEqual([])
    })

    it('should fail each change individually', async () => {
      expect(await createChangeValidator({
        client,
        apiConfig: DEFAULT_CONFIG[API_DEFINITIONS_CONFIG],
        fetchConfig: DEFAULT_CONFIG[FETCH_CONFIG],
        deployConfig: DEFAULT_CONFIG[DEPLOY_CONFIG],
        typesDeployedViaParent: [],
        typesWithNoDeploy: [],
      })([
        toChange({ after: new ObjectType({ elemID: new ElemID(ZENDESK, 'obj') }) }),
        toChange({ before: new ObjectType({ elemID: new ElemID(ZENDESK, 'obj2') }) }),
      ])).toEqual([
        {
          elemID: new ElemID(ZENDESK, 'obj'),
          severity: 'Error',
          message: 'Deployment of non-instance elements is not supported in adapter zendesk',
          detailedMessage: 'Deployment of non-instance elements is not supported in adapter zendesk. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.',
        },
        {
          elemID: new ElemID(ZENDESK, 'obj2'),
          severity: 'Error',
          message: 'Deployment of non-instance elements is not supported in adapter zendesk',
          detailedMessage: 'Deployment of non-instance elements is not supported in adapter zendesk. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.',
        },
      ])
    })
  })
  describe('checkDeploymentBasedOnConfigValidator', () => {
    it('should fail each change individually', async () => {
      const type = new ObjectType({ elemID: new ElemID(ZENDESK, 'obj') })
      expect(await createChangeValidator({
        client,
        apiConfig: DEFAULT_CONFIG[API_DEFINITIONS_CONFIG],
        fetchConfig: DEFAULT_CONFIG[FETCH_CONFIG],
        deployConfig: DEFAULT_CONFIG[DEPLOY_CONFIG],
        typesDeployedViaParent: [],
        typesWithNoDeploy: [],
      })([
        toChange({ after: new InstanceElement('inst1', type) }),
        toChange({ before: new InstanceElement('inst2', type) }),
      ])).toEqual([
        {
          elemID: new ElemID(ZENDESK, 'obj', 'instance', 'inst1'),
          severity: 'Error',
          message: 'Operation not supported',
          detailedMessage: 'Salto does not support "add" of zendesk.obj.instance.inst1. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.',
        },
        {
          elemID: new ElemID(ZENDESK, 'obj', 'instance', 'inst2'),
          severity: 'Error',
          message: 'Operation not supported',
          detailedMessage: 'Salto does not support "remove" of zendesk.obj.instance.inst2. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.',
        },
      ])
    })
  })
})
