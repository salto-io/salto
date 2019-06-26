import HCLParser from '../../src/parser/hcl'

describe('HCL Parser', () => {
  it('parses adapter config block', async () => {
    const configBlock = `salesforce { 
      user = "me" 
    }`

    const { body } = await HCLParser.Parse(Buffer.from(configBlock), 'none')
    expect(body.blocks.length).toEqual(1)
    const config = body.blocks[0]
    expect(config.type).toEqual('salesforce')
    expect(config.attrs).toHaveProperty('user')
    expect(config.attrs.user).toEqual('me')
  })

  it('parses type definition block', async () => {
    const typeDefBlock = `type compound salto_employee {
      string name {
        label = "Name"
      }

      number num {
        _default = 35
      }
    }`

    const { body } = await HCLParser.Parse(Buffer.from(typeDefBlock), 'none')
    expect(body.blocks.length).toEqual(1)
    const typeBlock = body.blocks[0]
    expect(typeBlock.type).toEqual('type')
    expect(typeBlock.labels).toEqual(['compound', 'salto_employee'])
    expect(typeBlock.blocks.length).toEqual(2)

    expect(typeBlock.blocks[0].type).toEqual('string')
    expect(typeBlock.blocks[0].labels).toEqual(['name'])
    expect(typeBlock.blocks[0].attrs).toHaveProperty('label')
    expect(typeBlock.blocks[0].attrs.label).toEqual('Name')

    expect(typeBlock.blocks[1].type).toEqual('number')
    expect(typeBlock.blocks[1].labels).toEqual(['num'])
    expect(typeBlock.blocks[1].attrs).toHaveProperty('_default')
    // eslint-disable-next-line no-underscore-dangle
    expect(typeBlock.blocks[1].attrs._default).toEqual(35)
  })

  it('parses instance block', async () => {
    const instanceDefBlock = `salto_employee me {
      name = "person"
      nicknames = [
        "a", "s", "d"
      ]
    }`

    const { body } = await HCLParser.Parse(
      Buffer.from(instanceDefBlock),
      'none',
    )
    expect(body.blocks.length).toEqual(1)
    const instBlock = body.blocks[0]
    expect(instBlock.type).toEqual('salto_employee')
    expect(instBlock.labels).toEqual(['me'])
    expect(instBlock.attrs).toHaveProperty('name')
    expect(instBlock.attrs.name).toEqual('person')
    expect(instBlock.attrs).toHaveProperty('nicknames')
    expect(instBlock.attrs.nicknames).toEqual(['a', 's', 'd'])
  })

  it('parses multiline strings', async () => {
    const blockDef = `type label {
      thing = <<EOF
        omg
        asd
        EOF
    }`

    const { body } = await HCLParser.Parse(Buffer.from(blockDef), 'none')
    expect(body.blocks.length).toEqual(1)
    expect(body.blocks[0].attrs).toHaveProperty('thing')
    expect(body.blocks[0].attrs.thing).toEqual('        omg\n        asd\n')
  })

  describe('parse error', () => {
    const blockDef = 'type some.thing {}'
    let parseErrors: string[]

    beforeAll(async () => {
      const { errors } = await HCLParser.Parse(Buffer.from(blockDef), 'none')
      parseErrors = errors
    })

    it('is not empty', () => {
      expect(parseErrors.length).not.toEqual(0)
    })

    it('contains the error location', () => {
      expect(parseErrors[0]).toContain('none:1')
    })
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
    const buffer = await HCLParser.Dump(body as HCLBlock)
    serialized = buffer.toString()
  })

  it('dumps type and labels', () => {
    expect(serialized).toMatch('type "lbl1" "lbl2" {')
  })
  it('dumps numbers', () => {
    expect(serialized).toMatch('number = 1')
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
})
