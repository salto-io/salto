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
import { EOL } from 'os'
import { ElemID } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { ZENDESK_SUPPORT } from '../src/constants'
import { getZendeskError } from '../src/errors'

describe('errors', () => {
  describe('formatZendeskError', () => {
    const elemId = new ElemID(ZENDESK_SUPPORT, 'obj', 'instance', 'inst')
    it('should return just the base error if no data in the response', async () => {
      expect(getZendeskError(
        elemId.getFullName(),
        new clientUtils.HTTPError(
          'err',
          { data: 'err' as unknown as clientUtils.ResponseValue, status: 400 }
        )
      )).toEqual(new Error(`Deployment of ${elemId.getFullName()} failed: Error: err`))
    })
    it('should return the correct error message', async () => {
      const data = { error: 'err' }
      expect(getZendeskError(
        elemId.getFullName(),
        new clientUtils.HTTPError('err', { data, status: 400 })
      )).toEqual(new Error(`Deployment of ${elemId.getFullName()} failed: Error: err${EOL}{${EOL}  "error": "err"${EOL}}`))
    })
  })
})
