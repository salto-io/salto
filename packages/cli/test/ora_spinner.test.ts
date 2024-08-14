/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
