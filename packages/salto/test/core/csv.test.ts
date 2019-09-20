import _ from 'lodash'
import path from 'path'
import * as asyncfile from 'async-file'
import * as csv from '../../src/core/csv'

describe('CSV reader/writer', () => {
  const csvDumpOutputDir = `${__dirname}/tmp/csv`
  const exportFile = 'dump_csv_test.csv'
  const outputPath = path.join(csvDumpOutputDir, exportFile)
  const csvDirectory = path.join(__dirname, '../../../test', 'csv')
  const importFileName = 'import.csv'

  describe('Write to CSV', () => {
    const values = [
      {
        Id: 1,
        FirstName: 'Daile',
        LastName: 'Limeburn',
        Email: 'dlimeburn0@blogs.com',
        Gender: 'Female',
      }, {
        Id: 2,
        FirstName: 'Murial',
        LastName: 'Morson',
        Email: 'mmorson1@google.nl',
        Gender: 'Female',
      }, {
        Id: 3,
        FirstName: 'Minna',
        LastName: 'Noe',
        Email: 'mnoe2@wikimedia.org',
        Gender: 'Female',
      },
    ]

    const additionalValues = [
      {
        Id: 4,
        FirstName: 'Dwayne',
        LastName: 'Johnson',
        Email: 'dwayne@therock.com',
        Gender: 'Male',
      },
    ]

    beforeEach(async () => {
      await asyncfile.delete(csvDumpOutputDir)
    })

    it('should write an array of objects properly to CSV without appending', async () => {
      await csv.dumpCsv(values, outputPath, false)
      expect(await asyncfile.exists(outputPath)).toBe(true)
      const fileStrings = (await asyncfile.readFile(outputPath)).toString().split('\n')
      expect(fileStrings[0]).toMatch(/Id,FirstName,LastName,Email,Gender/)
      expect(fileStrings[1]).toMatch(/1,"Daile","Limeburn","dlimeburn0@blogs.com","Female"/)
      expect(fileStrings[2]).toMatch(/2,"Murial","Morson","mmorson1@google.nl","Female"/)
      expect(fileStrings[3]).toMatch(/3,"Minna","Noe","mnoe2@wikimedia.org","Female"/)
    })

    it('should append arrays of objects properly to CSV without header', async () => {
      await csv.dumpCsv(values, outputPath, true)
      await csv.dumpCsv(additionalValues, outputPath, true)
      expect(await asyncfile.exists(outputPath)).toBe(true)
      const fileStrings = (await asyncfile.readFile(outputPath)).toString().split('\n')
      expect(fileStrings[0]).toMatch(/1,"Daile","Limeburn","dlimeburn0@blogs.com","Female"/)
      expect(fileStrings[1]).toMatch(/2,"Murial","Morson","mmorson1@google.nl","Female"/)
      expect(fileStrings[2]).toMatch(/3,"Minna","Noe","mnoe2@wikimedia.org","Female"/)
      expect(fileStrings[3]).toMatch(/4,"Dwayne","Johnson","dwayne@therock.com","Male"/)
    })

    it('should append arrays of objects properly to CSV with header', async () => {
      await csv.dumpCsv(values, outputPath, false)
      await csv.dumpCsv(additionalValues, outputPath, true)
      expect(await asyncfile.exists(outputPath)).toBe(true)
      const fileStrings = (await asyncfile.readFile(outputPath)).toString().split('\n')
      expect(fileStrings[0]).toMatch(/Id,FirstName,LastName,Email,Gender/)
      expect(fileStrings[1]).toMatch(/1,"Daile","Limeburn","dlimeburn0@blogs.com","Female"/)
      expect(fileStrings[2]).toMatch(/2,"Murial","Morson","mmorson1@google.nl","Female"/)
      expect(fileStrings[3]).toMatch(/3,"Minna","Noe","mnoe2@wikimedia.org","Female"/)
      expect(fileStrings[4]).toMatch(/4,"Dwayne","Johnson","dwayne@therock.com","Male"/)
    })
  })
  describe('Read from CSV', () => {
    it('should read contents of a CSV properly', async () => {
      const clarkKent = {
        Id: '',
        LastName: 'Kent',
        FirstName: 'Clark',
        Salutation: 'Mr',
        Title: 'Reporter',
        Company: 'Daily Planet',
        Street: 'Superman 13',
        City: 'Metropolis',
      }
      const bruceWayne = {
        Id: '',
        LastName: 'Wayne',
        FirstName: 'Bruce',
        Salutation: 'Mr',
        Title: 'CEO',
        Company: 'Wayne Enterprises',
        Street: 'Wayne mansion',
        City: 'Gotham',
      }
      const results = await csv.readCsv(path.join(csvDirectory, importFileName))
      expect(_.isEqual(results[0], clarkKent)).toBeTruthy()
      expect(_.isEqual(results[1], bruceWayne)).toBeTruthy()
    })
  })
})
