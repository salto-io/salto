import streams from 'memory-streams'
import { SpinnerCreator, Spinner } from 'src/types'
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
