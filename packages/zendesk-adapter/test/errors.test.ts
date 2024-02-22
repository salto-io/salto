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
import { EOL } from 'os'
import { createSaltoElementError, ElemID } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../src/constants'
import { getZendeskError } from '../src/errors'

describe('errors', () => {
  describe('formatZendeskError', () => {
    const elemId = new ElemID(ZENDESK, 'obj', 'instance', 'inst')
    it('should return just the base error if no data in the response', async () => {
      expect(
        getZendeskError(
          elemId,
          new clientUtils.HTTPError('err', { data: 'err' as unknown as clientUtils.ResponseValue, status: 400 }),
        ),
      ).toEqual(
        createSaltoElementError({
          message: 'Error: err',
          severity: 'Error',
          elemID: elemId,
        }),
      )
    })
    it('should return the correct error message', async () => {
      const data = { error: 'err' }
      expect(getZendeskError(elemId, new clientUtils.HTTPError('err', { data, status: 400 }))).toEqual(
        createSaltoElementError({
          message: `Error: err${EOL}{${EOL}  "error": "err"${EOL}}`,
          severity: 'Error',
          elemID: elemId,
        }),
      )
    })
    it('should return the correct error message for 403 error', async () => {
      const data = {
        errors: [
          { title: 'one', detail: 'one detail' },
          { title: 'two', detail: 'two detail' },
        ],
      }
      expect(getZendeskError(elemId, new clientUtils.HTTPError('err', { data, status: 403 }))).toEqual(
        createSaltoElementError({
          message: `${EOL}Error details:${EOL}* Title: one${EOL}  Detail: one detail${EOL}${EOL}* Title: two${EOL}  Detail: two detail${EOL}`,
          severity: 'Error',
          elemID: elemId,
        }),
      )
    })
    it('should return the correct error message for 422 error', async () => {
      const data = {
        description: 'abc',
        details: {
          a: [{ description: 'a-one des' }, { description: 'a-two des' }],
          b: [{ description: 'b-one des' }, { description: 'b-two des' }],
        },
      }
      expect(getZendeskError(elemId, new clientUtils.HTTPError('err', { data, status: 422 }))).toEqual(
        createSaltoElementError({
          message: `${EOL}${data.description}${EOL}${EOL}Error details:${EOL}* a-one des${EOL}* a-two des${EOL}* b-one des${EOL}* b-two des`,
          severity: 'Error',
          elemID: elemId,
        }),
      )
    })
    it('should return the correct error message for 400 error', async () => {
      const data = { error: { title: 'a', message: 'b' } }
      expect(getZendeskError(elemId, new clientUtils.HTTPError('err', { data, status: 400 }))).toEqual(
        createSaltoElementError({
          message: `${EOL}Error details:${EOL}* Title: a${EOL}  Detail: b${EOL}`,
          severity: 'Error',
          elemID: elemId,
        }),
      )
    })
  })
})
