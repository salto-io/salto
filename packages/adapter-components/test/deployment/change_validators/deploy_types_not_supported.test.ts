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
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployTypesNotSupportedValidator } from '../../../src/deployment/change_validators/deploy_types_not_supported'

describe('deployTypesNotSupportedValidator', () => {
  it('should return an error when the changed element is not an instance', async () => {
    const type = new ObjectType({ elemID: new ElemID('adapter', 'test') })

    const errors = await deployTypesNotSupportedValidator([
      toChange({ after: type }),
    ])
    expect(errors).toEqual([{
      elemID: type.elemID,
      severity: 'Error',
      message: `Deployment of non-instance elements is not supported in adapter ${type.elemID.adapter}`,
      detailedMessage: `Deployment of non-instance elements is not supported in adapter ${type.elemID.adapter}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
    }])
  })
})
