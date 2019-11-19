import { strings } from '../src/index'

describe('strings', () => {
  describe('insecureRandomString', () => {
    describe('when given no paramters', () => {
      let s: string
      beforeEach(() => {
        s = strings.insecureRandomString()
      })

      it('generates a string of length 10', () => {
        expect(s).toHaveLength(10)
      })

      it('generates a string from the default alphabet', () => {
        expect(s).toMatch(/[A-Za-z0-9]{10}/)
      })

      describe('when called again', () => {
        let s2: string
        beforeEach(() => {
          s2 = strings.insecureRandomString()
        })

        it('hopefully generates a different string', () => {
          expect(s2).not.toEqual(s)
        })
      })
    })

    describe('when given a length argument', () => {
      let s: string
      beforeEach(() => {
        s = strings.insecureRandomString({ length: 12 })
      })

      it('generates a string of the specified length', () => {
        expect(s).toHaveLength(12)
      })
    })

    describe('when given an alphabet argument', () => {
      let s: string
      beforeEach(() => {
        s = strings.insecureRandomString({ alphabet: 'abc' })
      })

      it('generates a string from the given alphabet', () => {
        expect(s).toMatch(/[abc]{10}/)
      })
    })
  })
})
