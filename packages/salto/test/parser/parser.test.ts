import HCLParser from '../../src/parser/hcl'

describe('HCL Parser', () => {
  it('parses adapter config block', async () => {
    expect.assertions(4)

    const configBlock = `salesforce { 
      user = "me" 
    }`

    const body = await HCLParser.Parse(Buffer.from(configBlock), 'none')
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

    const body = await HCLParser.Parse(Buffer.from(typeDefBlock), 'none')
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
})
