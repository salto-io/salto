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
import { EOL } from 'os'
import { ElemID } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../src/constants'
import { getZendeskError } from '../src/errors'

describe('errors', () => {
  describe('formatZendeskError', () => {
    const elemId = new ElemID(ZENDESK, 'obj', 'instance', 'inst')
    it('should return just the base error if no data in the response', async () => {
      expect(getZendeskError(
        elemId.getFullName(),
        new clientUtils.HTTPError(
          'err',
          { data: 'err' as unknown as clientUtils.ResponseValue, status: 400 }
        )
      )).toEqual(new Error(`Deployment of ${elemId.getFullName()} failed. Error: err`))
    })
    it('should return the correct error message', async () => {
      const data = { error: 'err' }
      expect(getZendeskError(
        elemId.getFullName(),
        new clientUtils.HTTPError('err', { data, status: 400 })
      )).toEqual(new Error(`Deployment of ${elemId.getFullName()} failed.\nError: err${EOL}{${EOL}  "error": "err"${EOL}}`))
    })
    it('should return the correct error message for 403 error', async () => {
      const data = { errors: [{ title: 'one', detail: 'one detail' }, { title: 'two', detail: 'two detail' }] }
      expect(getZendeskError(
        elemId.getFullName(),
        new clientUtils.HTTPError('err', { data, status: 403 })
      )).toEqual(new Error(`Deployment of ${elemId.getFullName()} failed.${EOL}\nError details:\n* Title: one\n  Detail: one detail\n\n* Title: two\n  Detail: two detail\n`))
    })
    it('should return the correct error message for 422 error', async () => {
      const data = {
        description: 'abc',
        details: {
          a: [{ description: 'a-one des' }, { description: 'a-two des' }],
          b: [{ description: 'b-one des' }, { description: 'b-two des' }],
        },
      }
      expect(getZendeskError(
        elemId.getFullName(),
        new clientUtils.HTTPError('err', { data, status: 422 })
      )).toEqual(new Error(`Deployment of ${elemId.getFullName()} failed.${EOL}\n${data.description}\n\nError details:${EOL}* a-one des\n* a-two des\n* b-one des\n* b-two des`))
    })
    it('should return the correct error message for 400 error', async () => {
      const data = { error: { title: 'a', message: 'b' } }
      expect(getZendeskError(
        elemId.getFullName(),
        new clientUtils.HTTPError('err', { data, status: 400 })
      )).toEqual(new Error(`Deployment of ${elemId.getFullName()} failed.${EOL}\nError details:\n* Title: a\n  Detail: b\n`))
    })
  })
})
