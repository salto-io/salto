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
import { getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/account_specific_values'
import { ACCOUNT_SPECIFIC_VALUE, APPLICATION_ID } from '../../src/constants'
import { addressForm } from '../../src/autogen/types/custom_types/addressForm'

describe('account_specific_values filter', () => {
  it('should remove account specific values', async () => {
    const instance = new InstanceElement(
      'instance',
      addressForm,
      {
        [APPLICATION_ID]: 'a.b.c',
        a: 2,
        b: ACCOUNT_SPECIFIC_VALUE,
        c: {
          d: `${ACCOUNT_SPECIFIC_VALUE}|${ACCOUNT_SPECIFIC_VALUE}`,
          e: 3,
        },
      }
    )
    const change = toChange({ after: instance })
    await filterCreator().preDeploy([change])
    expect(getChangeData(change).value).toEqual({ a: 2, c: { e: 3 }, [APPLICATION_ID]: 'a.b.c' })
  })
})
