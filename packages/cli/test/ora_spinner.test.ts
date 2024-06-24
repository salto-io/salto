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
import streams from 'memory-streams'
import { SpinnerCreator, Spinner } from '../src/types'
import oraSpinner from '../src/ora_spinner'

describe('use ora spinner', () => {
  let writableStream: NodeJS.WritableStream
  let oraSpinnerCreator: SpinnerCreator
  beforeEach(() => {
    writableStream = new streams.WritableStream()
    oraSpinnerCreator = oraSpinner({ outputStream: writableStream })
  })

  describe('created the spinner', () => {
    let spinner: Spinner
    beforeEach(() => {
      spinner = oraSpinnerCreator('start text', {})
    })

    it('should write on start', () => {
      expect(writableStream.toString()).toContain('start text')
    })

    it('it should write succeed message on succeed', () => {
      spinner.succeed('great success')
      expect(writableStream.toString()).toContain('great success')
    })

    it('should write fail message on failure', () => {
      spinner.fail('great failure')
      expect(writableStream.toString()).toContain('great failure')
    })
  })
})
