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
import _ from 'lodash'
import {
  TemplateExpression, ReferenceExpression, ElemID,
} from '@salto-io/adapter-api'
import { parse } from '../../../src/parser/internal/parse'
import { dump } from '../../../src/parser/internal/dump'
import {
  ParsedHclBlock, HclAttribute, HclExpression, HclParseError, DumpedHclBody, ParsedHclBody,
} from '../../../src/parser/internal/types'
import devaluate from './devaluate'
import evaluate from '../../../src/parser/expressions'
import { SourceRange } from '../../../src/parser/parse'
import {
  Functions,
} from '../../../src/parser/functions'
import {
  FunctionExpression,
} from '../../../src/parser/internal/functions'
import {
  registerTestFunction,
} from '../functions.test'


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

let functions: Functions
const funcName = 'funcush'
beforeAll(() => {
  functions = registerTestFunction(funcName)
})

describe('HCL parse', () => {
  it('parses adapter config block', async () => {
    const configBlock = `salesforce {
      user = "me"
    }`

    const { body } = parse(Buffer.from(configBlock), 'none')
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

    const { body } = parse(Buffer.from(typeDefBlock), 'none')
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

    const { body } = parse(Buffer.from(instanceDefBlock), 'none')
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
        thing = '''
          omg
          asd
          '''
      }`

    const { body } = parse(Buffer.from(blockDef), 'none')
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

    const { body } = parse(Buffer.from(blockDef), 'none')
    expect(body.blocks.length).toEqual(1)
    expect(body.blocks[0].attrs).toHaveProperty('thing')
    expect(body.blocks[0].attrs.thing.expressions[0].type).toEqual('reference')
    expect(body.blocks[0].attrs.thing.expressions[0].value).toEqual(['a', 'b'])
    expect(body.blocks[0].attrs.that.expressions[0].type).toEqual('template')
    expect(body.blocks[0].attrs.that.expressions[0].expressions.length).toEqual(3)
  })

  it('parses all numbers notation', () => {
    const blockDef = `type label {
      simple = 1
      sci = 1e10
      negative = -2
      negativeSci = -1e10
      float = 1.5
      negativeFloat = -1.5
      floatSci = 1.5e10

    }`

    const { body } = parse(Buffer.from(blockDef), 'none')
    expect(body.blocks.length).toEqual(1)
    expect(body.blocks[0].attrs.simple.expressions[0].value).toEqual(1)
    expect(body.blocks[0].attrs.sci.expressions[0].value).toEqual(1e10)
    expect(body.blocks[0].attrs.negative.expressions[0].value).toEqual(-2)
    expect(body.blocks[0].attrs.negativeSci.expressions[0].value).toEqual(-1e10)
    expect(body.blocks[0].attrs.float.expressions[0].value).toEqual(1.5)
    expect(body.blocks[0].attrs.negativeFloat.expressions[0].value).toEqual(-1.5)
    expect(body.blocks[0].attrs.floatSci.expressions[0].value).toEqual(1.5e10)
  })

  it('can run concurrently', async () => {
    const blockDef = 'type label {}'
    const blocksToParse = _.times(3, () => blockDef)
    const results = blocksToParse.map(block => parse(Buffer.from(block), 'none'))
    expect(results.length).toEqual(3)
    // Check the first result
    expect(results[0].body.blocks.length).toEqual(1)
    expect(results[0].body.blocks[0].type).toEqual('type')
    expect(results[0].body.blocks[0].labels).toEqual(['label'])
    // Check all the rest are the same
    results.reduce((prev, curr) => {
      expect(prev).toEqual(curr)
      return curr
    })
  })

  // If this test fails you probably replaced wasm_exec with a newer version and did not modify
  // the TextEncoder and Decoder to ignore DOM. See the old wasm_exec file lines 100:101
  it('Ignore BOM when parsing', async () => {
    const blockDef = `type voodoo {
      thing = "\ufeffHIDE"
    }`
    const { body } = parse(Buffer.from(blockDef), 'none')
    expect(body.blocks.length).toEqual(1)
    expect(body.blocks[0].attrs).toHaveProperty('thing')
    expect(evaluate(body.blocks[0].attrs.thing.expressions[0]).length).toEqual(5)
  })

  describe('parse error', () => {
    const blockDef = 'type some:thing {}'
    let errors: HclParseError[]

    beforeAll(async () => {
      ({ errors } = parse(Buffer.from(blockDef), 'none'))
    })

    it('is not empty', () => {
      expect(errors.length).not.toEqual(0)
    })

    it('contains the error location', () => {
      expect(errors[0].subject.start).toMatchObject({ line: 1, col: 10 })
      expect(errors[0].subject.filename).toBe('none')
    })

    it('contains the error summary', () => {
      expect(errors[0].summary).toBe('Unexpected token: :thing')
    })

    it('contains the error detail', () => {
      expect(errors[0].detail).not.toBeFalsy()
    })

    it('return error on duplicate keys', async () => {
      const multiDefBlock = `
        type multidef {
          key = "KEY"
          key = "KEYYY"
        }
      `
      const res = parse(Buffer.from(multiDefBlock), 'none')
      expect(res.errors[0].summary).toBe('Attribute redefined')
    })
  })

  // TODO: remove the skip once SALTO-487 is resolved
  // eslint-disable-next-line jest/no-disabled-tests
  describe.skip('traversal error', () => {
    const blockDef = 'type sometype { a = { foo.bar = 5 } }'
    let errors: HclParseError[]

    beforeAll(async () => {
      ({ errors } = parse(Buffer.from(blockDef), 'none'))
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

  describe('source ranges with errors', () => {
    const blockDef = `
      type foo {
        novalue =
        hasvalue = "value"
      }
    `
    let errors: HclParseError[]
    let body: ParsedHclBody

    beforeAll(async () => {
      ({ errors, body } = parse(Buffer.from(blockDef), 'none'))
    })

    it('should contain the parser error', () => {
      expect(errors).toHaveLength(1)
      expect(errors[0].summary).toContain('Unexpected token')
    })

    it('should create the parseable blocks', () => {
      expect(body.blocks).toHaveLength(1)
      const block = body.blocks[0]
      expect(_.keys(block.attrs)).toEqual(['novalue', 'hasvalue'])
      expect(block.attrs.hasvalue.expressions).toHaveLength(1)
      expect(evaluate(block.attrs.hasvalue.expressions[0])).toEqual('value')
    })

    it('should have proper ranges for the rest of the elements', () => {
      expect(body.blocks).toHaveLength(1)
      const block = body.blocks[0]
      expect(block.source).toEqual({
        filename: 'none',
        start: { byte: 7, col: 7, line: 2 },
        end: { byte: 85, col: 8, line: 5 },
      })
      expect(block.attrs.hasvalue.source).toEqual({
        filename: 'none',
        start: { byte: 59, col: 9, line: 4 },
        end: { byte: 77, col: 27, line: 4 },
      })
    })
  })

  describe('limit error recovery attempts', () => {
    const blockDef = `
      type statement {
        please = "let me finish
      }
    `
    let errors: HclParseError[]
    let body: ParsedHclBody

    beforeAll(async () => {
      ({ errors, body } = parse(Buffer.from(blockDef), 'none'))
    })

    it('should stop parsing on fatal error', () => {
      expect(body.blocks).toHaveLength(0)
      expect(errors.length).toBeGreaterThan(0)
    })
  })
})

describe('HCL dump', () => {
  const body: DumpedHclBody = {
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
            exp: new TemplateExpression({
              parts: [
                'test ',
                new ReferenceExpression(new ElemID('a', 'b')),
                ' test',
              ],
            }),
            somefunc: new FunctionExpression(
              funcName,
              ['ZOMG'],
            ),
            otherfunc: new FunctionExpression(
              funcName,
              [[false, 1, '4rlz']],
            ),
            mixedfunc: new FunctionExpression(
              funcName,
              [false, [1, 2, 3], '4rlz'],
            ),
            lastfunc: new FunctionExpression(
              funcName,
              [false, 1, '4rlz'],
            ),
            nestedfunc: new FunctionExpression(
              funcName,
              [false, [1, 2, [3, 4]], '4rlz'],
            ),
            superdeepnest: new FunctionExpression(
              funcName,
              [false, [1, 2, [3, [4, 5, { dsa: 321 }]]], '4rlz'],
            ),
            objinfunc: new FunctionExpression(
              funcName,
              [{ aaa: 123 }],
            ),
            nested: {
              val: 'so deep',
            },
          },
        },
        blocks: [],
      },
    ],
  }
  let serialized: string
  beforeAll(() => {
    serialized = dump(body).toString()
  })

  it('dumps type and labels', () => {
    expect(serialized).toMatch(/type "*lbl1"* "*lbl2"* {/)
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
    expect(serialized).toMatch(/empty\s*=\s*\[\s*\]/m)
  })
  it('dumps expressions', () => {
    // eslint-disable-next-line no-template-curly-in-string
    expect(serialized).toMatch('exp = "test ${ a.b } test"')
  })
  it('dumps functions with single parameters', () =>
    expect(serialized).toMatch('somefunc = funcush("ZOMG")'))
  it('dumps functions with list', () =>
    expect(serialized).toMatch(/otherfunc = funcush\(\n.+\[\n.+false,\n.+1,\n.+"4rlz",\n.+\],\n.+\)/m))
  it('dumps functions mixed parameters', () =>
    expect(serialized).toMatch(/mixedfunc = funcush\(\n.+false,\n.+\[\n.+1,\n.+2,\n.+3,\n.+\],\n.+"4rlz",\n.+\)/m))
  it('dumps functions several parameters', () =>
    expect(serialized).toMatch(/lastfunc = funcush\(\n.+false,\n.+1,\n.+"4rlz",\n.+\)/m))
  it('dumps functions nested parameters', () =>
    expect(serialized).toMatch(/nestedfunc = funcush\(\n.+false,\n.+\[\n.+1,\n.+2,\n.+\[\n.+3,\n.+4,\n.+\],\n.+\],\n.+"4rlz",\n.+\)/m))
  it('dumps functions really nested parameters', () =>
    expect(serialized).toMatch(/superdeepnest = funcush\(\n.+false,\n.+\[\n.+1,\n.+2,\n.+\[\n.+3,\n.+\[\n.+4,\n.+5,\n.+\{\n.+dsa = 321\n.+\},\n.+\],\n.+],\n.+],\n.+"4rlz",\n.+\)/m))
  it('dumps function with objects', () =>
    expect(serialized).toMatch(/objinfunc = funcush\(\n.+\{\n.+aaa = 123\n.+\},\n.+\)/m))

  it('handles nested attributes', () => {
    expect(serialized).toMatch(/nested\s*=\s*{\s*val\s*=\s*"so deep",*\s*}/m)
  })
  it('dumps parsable text', async () => {
    const parsed = parse(Buffer.from(serialized), 'none')

    expect(parsed.errors).toHaveLength(0)
    // Filter out source ranges since they are only generated during parsing
    const removeSrcFromBlock = (block: Partial<ParsedHclBlock>): ParsedHclBlock =>
      _.mapValues(block, (val, key) => {
        if (key === 'attrs') {
          return _.mapValues(val as Record<string, HclAttribute>, v => evaluate(
            v.expressions[0],
            undefined,
            undefined,
            functions,
          ))
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
