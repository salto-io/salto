import { DefaultMap } from '../../src/collections/map'

describe('DefaultMap', () => {
  describe('constructor', () => {
    let subject: DefaultMap<string, number>
    describe('when no entries argument is specified', () => {
      beforeEach(() => {
        subject = new DefaultMap<string, number>(() => 12)
      })

      it('should create an empty DefaultMap', () => {
        expect(subject).toBeInstanceOf(DefaultMap)
        expect(subject.size).toBe(0)
      })
    })

    describe('when an entries argument is specified', () => {
      const source = { x: 12, y: 13 }

      beforeEach(() => {
        subject = new DefaultMap<string, number>(() => 23, Object.entries(source))
      })

      it('should create a DefaultMap populated from the specified entries', () => {
        expect(subject).toBeInstanceOf(DefaultMap)
        expect(subject.size).toBe(2)
        expect(subject.get('x')).toBe(12)
        expect(subject.get('y')).toBe(13)
      })
    })
  })

  describe('get', () => {
    let subject: DefaultMap<string, {}>
    let initDefault: jest.Mock<{}>
    const initDefaultValue = {}
    let result: {}

    beforeEach(() => {
      initDefault = jest.fn(() => initDefaultValue)
      subject = new DefaultMap<string, {}>(initDefault)
    })

    describe('when the key exists', () => {
      const v = {}

      beforeEach(() => {
        subject.set('x', v)
        result = subject.get('x')
      })

      it('should return it', () => {
        expect(result).toBe(v)
      })

      it('should not call the initDefault function', () => {
        expect(initDefault).not.toHaveBeenCalled()
      })
    })

    describe('when the key does not exist', () => {
      beforeEach(() => {
        result = subject.get('x')
      })

      it('should call the initDefault function', () => {
        expect(initDefault).toHaveBeenCalled()
      })

      it('should return the initDefault result', () => {
        expect(result).toBe(initDefaultValue)
      })
    })
  })
})
