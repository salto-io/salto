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
        expect(initDefault).toHaveBeenCalledWith('x')
      })

      it('should return the initDefault result', () => {
        expect(result).toBe(initDefaultValue)
      })
    })
  })

  describe('getOrUndefined', () => {
    let subject: DefaultMap<string, {}>
    let initDefault: jest.Mock<{}>
    const initDefaultValue = {}
    let result: {} | undefined

    beforeEach(() => {
      initDefault = jest.fn(() => initDefaultValue)
      subject = new DefaultMap<string, {}>(initDefault)
    })

    describe('when the key exists', () => {
      const v = {}

      beforeEach(() => {
        subject.set('x', v)
        result = subject.getOrUndefined('x')
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
        result = subject.getOrUndefined('x')
      })

      it('should not call the initDefault function', () => {
        expect(initDefault).not.toHaveBeenCalled()
      })

      it('should return undefined', () => {
        expect(result).toBeUndefined()
      })

      it('should not add the key to the map', () => {
        expect(subject.has('x')).toBeFalsy()
      })
    })
  })
})
