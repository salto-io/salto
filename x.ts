import fs from 'fs'
import { Workspace, loadConfig } from 'salto'
import { SalesforceClient } from 'salesforce-adapter'

const main = async () => {
  // const client = new SalesforceClient({
  //   credentials: {
  //     username: 'oren.ariel@capriza.com',
  //     password: 'Capriza!23',
  //     apiToken: 'E2TLjUCp8YN13kpidDhF1TLtz',
  //     isSandbox: false,
  //   }
  // })
  const client = new SalesforceClient({
    credentials: {
      username: 'ori.moisis@cunning-fox-h7c6vv.com',
      password: '123456!A',
      apiToken: '23oPjlEbFJF2BmnR3DTLouka',
      isSandbox: false,
    }
  })
  // const client = new SalesforceClient({
  //   credentials: {
  //     username: 'ori.moisis@curious-wolf-b140ep.com',
  //     password: '123456!A',
  //     apiToken: 'b1zCRPE1iT8Fuhc4jP99Fedi',
  //     isSandbox: false,
  //   }
  // })


  // const res = await client.readMetadata('CustomObject', ['Lead'])
  const x = await client.listMetadataObjects('Profile')
  // const desc = await client.describeMetadataType('Layout')
  // const layout = await client.readMetadata('Layout', 'Lead-Lead Layout')
  // const res = await client.readMetadata('CustomObject', ['Lead'])
  console.log('done')

  // const config = await loadConfig('/Users/orimo/code/discover_results/vanilla_ori')
  // const ws = await Workspace.load(config)
  // console.log(ws.hasErrors())

  // const buf = fs.readFileSync('/Users/orimo/code/discover_results/vanilla_ori/config.bp')
  // console.log('read file')
  // const x = await HclParser.parse(buf.toString(), 'file')
  // console.log('finished await')
  // console.log(x)
}

main()