import { SpinnerCreator } from 'src/types'
import { mockWritableStream, MockWritableStream } from './mocks'
import oraSpinner from '../src/ora_spinner'


describe('use ora spinner', () => {
  let writableStream: MockWritableStream
  let oraSpinnerCreator: SpinnerCreator
  beforeEach(() => {
    writableStream = mockWritableStream()
    oraSpinnerCreator = oraSpinner({ outputStream: writableStream })
  })

  describe('created the spinner', () => {
    beforeEach(() => {
      oraSpinnerCreator('start text', {})
    })

    it('should write on start', () => {
      expect(writableStream.contents()).toContain('start text')
    })
  })
})
