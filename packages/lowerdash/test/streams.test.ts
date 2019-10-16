import { streams } from '../src/index'

describe('streams', () => {
  describe('hasColors', () => {
    let stream: streams.MaybeTty

    describe('when a stream has no isTTY property', () => {
      beforeEach(() => {
        stream = {}
      })

      it('returns false', () => {
        expect(streams.hasColors(stream)).toBe(false)
      })
    })

    describe('when a stream is not TTY', () => {
      beforeEach(() => {
        stream = { isTTY: false }
      })

      it('returns false', () => {
        expect(streams.hasColors(stream)).toBe(false)
      })
    })

    describe('when a stream is TTY', () => {
      beforeEach(() => {
        stream = { isTTY: true }
      })

      describe('and has no getColorDepth func', () => {
        it('returns false', () => {
          expect(streams.hasColors(stream)).toBe(false)
        })
      })

      describe('and has a getColorDepth func', () => {
        describe('which returns 1', () => {
          beforeEach(() => {
            stream.getColorDepth = () => 1
          })


          it('returns false', () => {
            expect(streams.hasColors(stream)).toBe(false)
          })
        })

        describe('which returns greater than 1', () => {
          beforeEach(() => {
            stream.getColorDepth = () => 2
          })

          it('returns true', () => {
            expect(streams.hasColors(stream)).toBe(true)
          })
        })
      })
    })
  })
})
