import _ from 'lodash'
// import { createInlineAsyncParser } from '../../../src/parser/internal/go_parser'
import { createWorkerParser } from '../../../src/parser/internal/worker'
import {
  ParsedHclBlock, HclAttribute, HclExpression, HclParseError, AsyncHclParser,
} from '../../../src/parser/internal/types'
import devaluate from './devaluate'
import evaluate from '../../../src/parser/expressions'
import { SourceRange } from '../../../src/parser/parse'

const expectSourceLocation = (
  { source }: { source: SourceRange},
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number,
): void => {
  expect(source).toBeDefined()
  expect(source.filename).toEqual('none')
  expect(source.start.line).toEqual(startLine)
  expect(source.start.col).toEqual(startCol)
  expect(source.end.line).toEqual(endLine)
  expect(source.end.col).toEqual(endCol)
}

const expectExpressionsMatch = (actual: HclExpression, expected: HclExpression): void => {
  const omitSource = (exp: HclExpression): HclExpression =>
    _.mapValues(exp, (val, key) => {
      if (key === 'source') {
        return undefined
      }
      if (key === 'expressions') {
        return val.map(omitSource)
      }
      return val
    })
  expect(omitSource(actual)).toEqual(omitSource(expected))
}

describe('HCL Parser', () => {
  let parser: AsyncHclParser
  beforeAll(async () => {
    parser = await createWorkerParser()
  })

  afterAll(async () => {
    await parser.stop()
  })

  it('parses adapter config block', async () => {
    const configBlock = `salesforce {
      user = "me"
    }`

    const { body } = await parser.parse(configBlock, 'none')
    expect(body.blocks.length).toEqual(1)
    const config = body.blocks[0]
    expect(config.type).toEqual('salesforce')
    expect(config.attrs).toHaveProperty('user')
    expect(config.attrs.user).toHaveProperty('expressions')
    expectExpressionsMatch(config.attrs.user.expressions[0], devaluate('me'))
  })

  it('parses type definition block', async () => {
    const typeDefBlock = `type compound salto_employee {
        string name {
          // comment
          label = "Name"
        }

        // another comment
        number num {
          _default = 35
        }
      }`

    const { body } = await parser.parse(typeDefBlock, 'none')
    expect(body.blocks.length).toEqual(1)
    const typeBlock = body.blocks[0]
    expect(typeBlock.type).toEqual('type')
    expect(typeBlock.labels).toEqual(['compound', 'salto_employee'])
    expect(typeBlock.blocks.length).toEqual(2)
    expectSourceLocation(typeBlock, 1, 1, 11, 8)

    expect(typeBlock.blocks[0].type).toEqual('string')
    expect(typeBlock.blocks[0].labels).toEqual(['name'])
    expectExpressionsMatch(typeBlock.blocks[0].attrs.label.expressions[0], devaluate('Name'))
    expectSourceLocation(typeBlock.blocks[0], 2, 9, 5, 10)
    expectSourceLocation(typeBlock.blocks[0].attrs.label, 4, 11, 4, 25)

    expect(typeBlock.blocks[1].type).toEqual('number')
    expect(typeBlock.blocks[1].labels).toEqual(['num'])
    // eslint-disable-next-line no-underscore-dangle
    expectExpressionsMatch(typeBlock.blocks[1].attrs._default.expressions[0], devaluate(35))
    expectSourceLocation(typeBlock.blocks[1], 8, 9, 10, 10)
    // eslint-disable-next-line no-underscore-dangle
    expectSourceLocation(typeBlock.blocks[1].attrs._default, 9, 11, 9, 24)
  })

  it('parses instance block', async () => {
    const instanceDefBlock = `salto_employee me {
        name = "person"
        nicknames = [
          "a", "s", "d"
        ]
      }`

    const { body } = await parser.parse(instanceDefBlock, 'none')
    expect(body.blocks.length).toEqual(1)
    const instBlock = body.blocks[0]
    expect(instBlock.type).toEqual('salto_employee')
    expect(instBlock.labels).toEqual(['me'])
    expect(instBlock.attrs).toHaveProperty('name')
    expectExpressionsMatch(instBlock.attrs.name.expressions[0], devaluate('person'))
    expect(instBlock.attrs).toHaveProperty('nicknames')
    expect(instBlock.attrs.nicknames.expressions).toBeDefined()
    const nicknamesExpr = instBlock.attrs.nicknames.expressions[0]
    expectExpressionsMatch(nicknamesExpr, devaluate(['a', 's', 'd']))
  })

  it('parses multiline strings', async () => {
    const blockDef = `type label {
        thing = <<EOF
          omg
          asd
          EOF
      }`

    const { body } = await parser.parse(blockDef, 'none')
    expect(body.blocks.length).toEqual(1)
    expect(body.blocks[0].attrs).toHaveProperty('thing')
    expect(body.blocks[0].attrs.thing.expressions[0].type).toEqual('template')
    expect(body.blocks[0].attrs.thing.expressions[0].expressions.length).toEqual(2)
  })

  it('parses references', async () => {
    const blockDef = `type label {
        thing = a.b
        that = ">>>\${a.b}<<<"
      }`

    const { body } = await parser.parse(blockDef, 'none')
    expect(body.blocks.length).toEqual(1)
    expect(body.blocks[0].attrs).toHaveProperty('thing')
    expect(body.blocks[0].attrs.thing.expressions[0].type).toEqual('reference')
    expect(body.blocks[0].attrs.thing.expressions[0].value).toEqual(['a', 'b'])
    expect(body.blocks[0].attrs.that.expressions[0].type).toEqual('template')
    expect(body.blocks[0].attrs.that.expressions[0].expressions.length).toEqual(3)
  })

  // describe('concurrent execution', () => {
  //   let results: HclParseReturn[]
  //   let parser: HclParserCls
  //   let parserPoolStop: jest.SpyInstance

  //   // For some reason multi-threaded parsing takes significantly longer in jest
  //   jest.setTimeout(30 * 1000)

  //   beforeAll(async () => {
  //     parser = new HclParserCls(false)
  //     parserPoolStop = jest.spyOn(parser, 'stop')
  //     const blocksToParse = _.times(3, num => `type label_${num} {}`)
  //     results = await Promise.all(
  //       blocksToParse.map(block => parser.parse(block, 'none'))
  //     )
  //   })

  //   it('returns correct results', () => {
  //     expect(results.length).toEqual(3)
  //     const checkResult = (result: HclParseReturn, idx: number): void => {
  //       expect(result.body.blocks).toHaveLength(1)
  //       expect(result.body.blocks[0].type).toEqual('type')
  //       expect(result.body.blocks[0].labels).toEqual([`label_${idx}`])
  //     }
  //     results.forEach(checkResult)
  //   })

  //   it('should stop the worker pool', () => {
  //     expect(parserPoolStop).toHaveBeenCalled()
  //   })
  // })

  // If this test fails you probably replaced wasm_exec with a newer version and did not modify
  // the TextEncoder and Decoder to ignore DOM. See the old wasm_exec file lines 100:101
  it('Ignore BOM when parsing', async () => {
    const blockDef = `type voodoo {
      thing = "\ufeffHIDE"
    }`
    const { body } = await parser.parse(blockDef, 'none')
    expect(body.blocks.length).toEqual(1)
    expect(body.blocks[0].attrs).toHaveProperty('thing')
    expect(evaluate(body.blocks[0].attrs.thing.expressions[0]).length).toEqual(5)
  })

  describe('parse error', () => {
    const blockDef = 'type some.thing {}'
    let errors: HclParseError[]

    beforeEach(async () => {
      ({ errors } = await parser.parse(blockDef, 'none'))
    })

    it('is not empty', () => {
      expect(errors.length).not.toEqual(0)
    })

    it('contains the error location', () => {
      expect(errors[0].subject.start).toMatchObject({ line: 1, col: 10 })
      expect(errors[0].subject.filename).toBe('none')
    })

    it('contains the error summary', () => {
      expect(errors[0].summary).toBe('Invalid block definition')
    })

    it('contains the error detail', () => {
      expect(errors[0].detail).not.toBeFalsy()
    })
  })

  describe('traversal error', () => {
    const blockDef = 'type sometype { a = { foo.bar = 5 } }'
    let errors: HclParseError[]

    beforeEach(async () => {
      ({ errors } = await parser.parse(blockDef, 'none'))
    })

    it('is not empty', () => {
      expect(errors.length).not.toEqual(0)
    })

    it('contains the error location', () => {
      expect(errors[0].subject.start).toMatchObject({ line: 1, col: 23 })
      expect(errors[0].subject.filename).toBe('none')
    })

    it('contains the error summary', () => {
      expect(errors[0].summary).toBe('Ambiguous attribute key')
    })

    it('contains the error detail', () => {
      expect(errors[0].detail).not.toBeFalsy()
    })
  })

  describe('HCL dump', () => {
    const body = {
      attrs: {},
      blocks: [
        {
          type: 'type',
          labels: ['lbl1', 'lbl2'],
          attrs: {
            attr: {
              number: 1,
              str: 'string',
              lst: ['val1', 'val2'],
              empty: [],
              nested: {
                val: 'so deep',
              },
            },
          },
          blocks: [],
        },
      ],
    } as unknown
    let serialized: string

    beforeEach(async () => {
      const buffer = await parser.dump(body as ParsedHclBlock)
      serialized = buffer.toString()
    })

    it('dumps type and labels', () => {
      expect(serialized).toMatch('type "lbl1" "lbl2" {')
    })
    it('dumps numbers', () => {
      expect(serialized).toMatch(/number\s*=\s*1/m)
    })
    it('dumps strings', () => {
      expect(serialized).toMatch(/str\s*=\s*"string"/m)
    })
    it('dumps lists', () => {
      expect(serialized).toMatch(/lst\s*=\s*[\s*"val1",\s*"val2"\s*]/m)
    })
    it('dumps empty list', () => {
      expect(serialized).toMatch(/empty\s*=\s*\[\]/m)
    })
    it('handles nested attributes', () => {
      expect(serialized).toMatch(/nested\s*=\s*{\s*val\s*=\s*"so deep"\s*}/m)
    })
    it('dumps parsable text', async () => {
      const parsed = await parser.parse(serialized, 'none')
      expect(parsed.errors.length).toEqual(0)
      // Filter out source ranges since they are only generated during parsing
      const removeSrcFromBlock = (block: ParsedHclBlock): ParsedHclBlock =>
        _.mapValues(block, (val, key) => {
          if (key === 'attrs') {
            return _.mapValues(val as Record<string, HclAttribute>, v => evaluate(v.expressions[0]))
          }
          if (key === 'blocks') {
            return (val as ParsedHclBlock[]).map(blk => removeSrcFromBlock(blk))
          }
          if (key === 'source') {
            return undefined
          }
          return val
        }) as ParsedHclBlock

      const parsedBody = removeSrcFromBlock(parsed.body)
      expect(body).toEqual(parsedBody)
    })
  })
})
