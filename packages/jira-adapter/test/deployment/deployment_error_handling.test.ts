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
import { client } from '@salto-io/adapter-components'
import { handleDeploymentError } from '../../src/deployment/deployment_error_handling'

describe('handleDeploymentError', () => {
  let error: Error | undefined
  it('should change message', async () => {
    error = new client.HTTPError('error', {
      status: 400,
      data: { errorMessages: ['error1', 'error2'], errors: { some_key: 'some value' } },
    })
    const result = handleDeploymentError(error).message
    expect(result).toEqual('error. error1, error2, {"some_key":"some value"}')
  })
  it('should keep the same message', async () => {
    error = new Error('error')
    const result = handleDeploymentError(error).message
    expect(result).toEqual('error')
  })
})
