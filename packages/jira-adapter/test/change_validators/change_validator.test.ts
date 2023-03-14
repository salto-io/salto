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
import { toChange, ObjectType, ElemID } from '@salto-io/adapter-api'
import { mockClient } from '../utils'
import changeValidator from '../../src/change_validators'
import { JIRA } from '../../src/constants'
import { getDefaultConfig } from '../../src/config/config'

describe('change validator creator', () => {
  describe('checkDeploymentAnnotationsValidator', () => {
    const { client, paginator } = mockClient()

    it('should not fail if there are no deploy changes', async () => {
      expect(
        await changeValidator(
          client, getDefaultConfig({ isDataCenter: false }), paginator
        )([])
      ).toEqual([])
    })

    it('should fail each change individually', async () => {
      expect(await changeValidator(
        client, getDefaultConfig({ isDataCenter: false }), paginator
      )([
        toChange({ after: new ObjectType({ elemID: new ElemID(JIRA, 'obj') }) }),
        toChange({ before: new ObjectType({ elemID: new ElemID(JIRA, 'obj2') }) }),
      ])).toEqual([
        {
          elemID: new ElemID(JIRA, 'obj'),
          severity: 'Error',
          message: 'Deployment of non-instance elements is not supported in adapter jira',
          detailedMessage: 'Deployment of non-instance elements is not supported in adapter jira. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.',
        },
        {
          elemID: new ElemID(JIRA, 'obj2'),
          severity: 'Error',
          message: 'Deployment of non-instance elements is not supported in adapter jira',
          detailedMessage: 'Deployment of non-instance elements is not supported in adapter jira. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.',
        },
      ])
    })
  })
})
