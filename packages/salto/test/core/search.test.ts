import { Element, ObjectType } from 'adapter-api'
import { findElement, FoundSearchResult } from '../../src/core/search'
import { getAllElements } from '../common/elements'

describe('findElement', () => {
  let elements: Element[]
  const find = (name: string): Element =>
    elements.find(e => e.elemID.getFullName() === name) as Element
  beforeAll(async () => {
    elements = await getAllElements()
  })

  it('should not find when describing a complete mismatch', async () => {
    const result = findElement(['ZZZZZZZ'], elements)
    expect(result).toBe(null)
  })

  it('should not find when describing a complete mismatch with multiple parts', async () => {
    const result = findElement(['XXX', 'ggg', 'A'], elements)
    expect(result).toBe(null)
  })

  it('should find proper top level element', async () => {
    const result = findElement(['salto.office'], elements) as FoundSearchResult
    expect(result.key).toBe('salto.office')
    expect(result.element).toEqual(find('salto.office'))
    expect(result.isGuess).toBe(false)
  })

  it('should find field', async () => {
    const result = findElement(['salto.employee', 'nicknames'], elements) as FoundSearchResult
    expect(result.key).toBe('salto.employee.nicknames')
    expect(result.element).toEqual((find('salto.employee') as ObjectType).fields.nicknames.type)
    expect(result.isGuess).toBe(false)
  })

  it('suggest type on single word', async () => {
    const result = findElement(['salto.ofice'], elements) as FoundSearchResult
    expect(result.key).toBe('salto.office')
    expect(result.isGuess).toBe(true)
    expect(result.element).toEqual(find('salto.office'))
  })

  it('should suggest on complex path', async () => {
    const result = findElement(['salto.offic', 'locatin', 'city'], elements) as FoundSearchResult
    expect(result.key).toBe('salto.office.location.city')
    expect(result.isGuess).toBe(true)

    const office = find('salto.office') as ObjectType
    const location = office.fields.location.type as ObjectType
    expect(result.element).toEqual(location.fields.city.type)
  })
})
