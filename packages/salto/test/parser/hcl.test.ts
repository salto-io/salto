import _ from 'lodash'
import HCLParser from '../../src/parser/hcl'
import {
  evaluate, HCLExpression, HCLComplexExpression, HCLLiteralExpression,
} from '../../src/parser/expressions'

describe('HCL Parser', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devalute = (value: any): HCLExpression => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devaluteValue = (v: any): HCLLiteralExpression => ({
      type: 'literal',
      value: v,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devaluteString = (str: string): HCLComplexExpression => ({
      type: 'template',
      expressions: [devaluteValue(str)],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devaluteArray = (arr: any[]): HCLComplexExpression => ({
      type: 'list',
      expressions: arr.map(e => devalute(e)),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devaluteObject = (obj: Record<string, any>): HCLComplexExpression => ({
      type: 'map',
      expressions: _(obj).entries().flatten().map(e => devalute(e))
        .value(),
    })

    if (_.isString(value)) {
      return devaluteString(value as string)
    }
    if (_.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return devaluteArray(value as any[])
    }
    if (_.isPlainObject(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return devaluteObject(value as Record<string, any>)
    }
    return devaluteValue(value)
  }

  it('parses adapter config block', async () => {
    const configBlock = `salesforce { 
      user = "me" 
    }`

    const { body } = await HCLParser.parse(Buffer.from(configBlock), 'none')
    expect(body.blocks.length).toEqual(1)
    const config = body.blocks[0]
    expect(config.type).toEqual('salesforce')
    expect(config.attrs).toHaveProperty('user')
    expect(config.attrs.user).toHaveProperty('expressions')
    expect(config.attrs.user.expressions).toEqual([devalute('me')])
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expectSourceLocation = (value: any, startLine: number, endLine: number): void => {
      expect(value.source).toBeDefined()
      if (value.src !== undefined) {
        // If block is needed in order to fool the ts compiler
        expect(value.source.filename).toEqual('none')
        expect(value.source.start.line).toEqual(startLine)
        expect(value.source.end.line).toEqual(endLine)
      }
    }

    const { body } = await HCLParser.parse(Buffer.from(typeDefBlock), 'none')
    expect(body.blocks.length).toEqual(1)
    const typeBlock = body.blocks[0]
    expect(typeBlock.type).toEqual('type')
    expect(typeBlock.labels).toEqual(['compound', 'salto_employee'])
    expect(typeBlock.blocks.length).toEqual(2)
    expectSourceLocation(typeBlock, 1, 11)

    expect(typeBlock.blocks[0].type).toEqual('string')
    expect(typeBlock.blocks[0].labels).toEqual(['name'])
    expect(typeBlock.blocks[0].attrs.label.expressions).toEqual([devalute('Name')])
    expectSourceLocation(typeBlock.blocks[0], 2, 5)
    expectSourceLocation(typeBlock.blocks[0].attrs.label, 4, 4)

    expect(typeBlock.blocks[1].type).toEqual('number')
    expect(typeBlock.blocks[1].labels).toEqual(['num'])
    // eslint-disable-next-line no-underscore-dangle
    expect(typeBlock.blocks[1].attrs._default.expressions).toEqual([devalute(35)])
    expectSourceLocation(typeBlock.blocks[1], 8, 10)
    // eslint-disable-next-line no-underscore-dangle
    expectSourceLocation(typeBlock.blocks[1].attrs._default, 9, 9)
  })

  it('parses instance block', async () => {
    const instanceDefBlock = `salto_employee me {
        name = "person"
        nicknames = [
          "a", "s", "d"
        ]
      }`

    const { body } = await HCLParser.parse(
      Buffer.from(instanceDefBlock),
      'none',
    )
    expect(body.blocks.length).toEqual(1)
    const instBlock = body.blocks[0]
    expect(instBlock.type).toEqual('salto_employee')
    expect(instBlock.labels).toEqual(['me'])
    expect(instBlock.attrs).toHaveProperty('name')
    expect(instBlock.attrs.name.expressions).toEqual([devalute('person')])
    expect(instBlock.attrs).toHaveProperty('nicknames')
    expect(instBlock.attrs.nicknames.expressions).toEqual([devalute(['a', 's', 'd'])])
  })

  it('parses multiline strings', async () => {
    const blockDef = `type label {
        thing = <<EOF
          omg
          asd
          EOF
      }`

    const { body } = await HCLParser.parse(Buffer.from(blockDef), 'none')
    expect(body.blocks.length).toEqual(1)
    expect(body.blocks[0].attrs).toHaveProperty('thing')
    expect(body.blocks[0].attrs.thing.expressions[0].type).toEqual('template')
    expect(body.blocks[0].attrs.thing.expressions[0].expressions.length).toEqual(2)
  })

  it('can run concurrently', async () => {
    const blockDef = 'type label {}'
    const blocksToParse = _.times(3, () => blockDef)
    const results = await Promise.all(
      blocksToParse.map(block => HCLParser.parse(Buffer.from(block), 'none'))
    )
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

  describe('parse error', () => {
    const blockDef = 'type some.thing {}'
    let parseErrors: string[]

    beforeAll(async () => {
      const { errors } = await HCLParser.parse(Buffer.from(blockDef), 'none')
      parseErrors = errors
    })

    it('is not empty', () => {
      expect(parseErrors.length).not.toEqual(0)
    })

    it('contains the error location', () => {
      expect(parseErrors[0]).toContain('none:1')
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

    beforeAll(async () => {
      const buffer = await HCLParser.dump(body as HCLBlock)
      serialized = buffer.toString()
    })

    it('dumps type and labels', () => {
      expect(serialized).toMatch('type "lbl1" "lbl2" {')
    })
    it('dumps numbers', () => {
      expect(serialized).toMatch('number = 1')
    })
    it('dumps strings', () => {
      expect(serialized).toMatch('str = "string"')
    })
    it('dumps lists', () => {
      expect(serialized).toMatch('lst = ["val1", "val2"]')
    })
    it('dumps empty list', () => {
      expect(serialized).toMatch('empty = []')
    })
    it('handles nested attributes', () => {
      expect(serialized).toMatch(/nested = { val = "so deep" }/m)
    })
    it('dumps parsable text', async () => {
      const parsed = await HCLParser.parse(Buffer.from(serialized), 'none')
      expect(parsed.errors.length).toEqual(0)
      // Filter out source ranges since they are only generated during parsing
      const removeSrcFromBlock = (block: HCLBlock): HCLBlock =>
        _.mapValues(block, (val, key) => {
          if (key === 'attrs') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return _.mapValues(val, (v: any) => evaluate(v.expressions[0]))
          }
          if (key === 'blocks') {
            return (val as HCLBlock[]).map(blk => removeSrcFromBlock(blk))
          }
          if (key === 'source') {
            return undefined
          }
          return val
        }) as HCLBlock

      const parsedBody = removeSrcFromBlock(parsed.body)
      expect(body).toEqual(parsedBody)
    })
  })
})
