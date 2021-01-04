/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ProgressReporter } from '@salto-io/adapter-api'
import { reportProgress } from '../src/progress'
import { MockInterface } from './common'

describe('progress reporter utils', () => {
  describe('progress reporter utils', () => {
    it('should call progress reporter\' reportProgress', () => {
      const details = 'test'
      const mockReportProgress = jest.fn()
      const mockProgressReporter: MockInterface<ProgressReporter> = {
        reportProgress: mockReportProgress,
      }
      reportProgress(details, mockProgressReporter)
      expect(mockReportProgress).toHaveBeenCalledWith({ details })
    })
  })
})
