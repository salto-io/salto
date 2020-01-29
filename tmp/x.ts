import fs from 'fs'
import { Workspace, loadConfig } from 'salto'
import SalesforceAdapter, { SalesforceClient } from 'salesforce-adapter'
import { CustomPicklistValue } from 'salesforce-adapter/src/client/types'
import { findElements } from 'salesforce-adapter/test/utils'
import { ObjectType } from 'adapter-api'
import { API_VERSION } from 'salesforce-adapter/src/client/client'
import { fromRetrieveResult } from 'salesforce-adapter/src/transformers/xml_transformer'
import _ from 'lodash'
import { CUSTOM_FIELD } from 'salesforce-adapter/dist/src/constants'

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
      username: 'noam+2@hammer.io',
      password: 'Password1!',
      apiToken: 'mPYbUlhoKf1cYzQQZIadqhGBg',
      isSandbox: false,
    }
  })
  // const client = new SalesforceClient({
  //   credentials: {
  //     username: 'yo@man.io',
  //     password: 'Password1!',
  //     apiToken: '5VJF692RQYHegjHHVGZ34TjU',
  //     isSandbox: false,
  //   }
  // })

  const retrieveRequest = {
    apiVersion: '46.0',
    singlePackage: false,
    unpackaged: [{ types: { name: 'Profile', members: '*' } }],
  }

  // const x = await client.listMetadataObjects('Role')
  // const xx = await client.describeMetadataType('Role')
  // const xxx = await client.readMetadata('Role', ['CEO'])

  // const c = await client.listSObjects()
  // const bb = await client.listMetadataTypes()
  // const z = await Promise.all((bb.map(e => client.listMetadataObjects(e.xmlName))))
  // const sobjectsList = await client.listSObjects()
  // const sobjectNames = sobjectsList.map(sobj => sobj.name)
  // const yo = await client.describeSObjects(sobjectNames)
  //const bll = await client.conn.soap.describeSObjects(chunk)
  // const nn = await client.listMetadataTypes()
  // const n = await client.readMetadata('CustomObject', ['Account', 'Lead', 'ProfileUserPermission'])
  // const zz = await client.retrieve(retrieveRequest)
  // const n = await client.readMetadata('CustomObject', ['Account'])
  // const zzz = await client.readMetadata('User', ['Integration User'])
  // const res = await client.readMetadata('Profile', ['bla'])
  // const ress = await client.retrieve(retrieveRequest)
  // const instanceInfos = (await fromRetrieveResult(zz, ['profile']))
  // const z = await client.describeSObjects([x[14].fullName])
  // const yalla = await client.listMetadataObjects({ type: 'CustomObject' }
  // const y = await client.describeSObjects(['QuickText'])
  // const ydo = await client.describeSObjects(['Account', 'Lead', 'TestAddFields__c'])
  const p = await client.readMetadata('Profile', ['Cross Org Data Proxy User'])
  const adapter = new SalesforceAdapter({client})
 
  // const r = await client
  //const q = await client.update('CustomField', t)
  // const r = await client.upsert(CUSTOM_FIELD, t)
  const rrr = await client.readMetadata('CustomObject', ['TestFields__c'])
  // const r = await client.readMetadata('StandardValueSet', ['LeadSource'])
  const rr = await client.readMetadata('GlobalValueSet', ['t'])
  const res = await client.readMetadata('CustomObject', ['TestAddFields__c'])
  //const a = await client.readMetadata('CustomObject', 'TestAddFields__c')
  const queryString = 'SELECT * FROM Lead'
  //const bla = await client.runQuery(queryString)
  // const yoman = await client.listSObjects()
  // const c = await client.describeMetadataType('ProfileUserPermission')
  // const b = await client.describeSObjects(['Lead'])
  const a = await adapter.fetch()
  //const result = await adapter.fetch()
  // const yy = await client.describeMetadataType('ProfileUserPermission')

  // const desc = await client.describeMetadataType('Layout')
  // const layout = await client.readMetadata('Layout', 'Lead-Lead Layout')
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