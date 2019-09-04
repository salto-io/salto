import path from 'path'
import * as asyncfile from 'async-file'
import * as csv from '../../src/cli/csv'

const csvDumpOutputDir = `${__dirname}/tmp/csv`
const exportFile = 'dump_csv_test.csv'
const outputPath = path.join(csvDumpOutputDir, exportFile)

describe('CSV reader/writer', () => {
  beforeEach(() => {
    jest.setTimeout(1000)
  })

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

    beforeEach(async () => {
      await asyncfile.delete(csvDumpOutputDir)
    })

    it('should write an array of objects properly to CSV', async () => {
      await csv.dumpCsv(values, outputPath)
      expect(await asyncfile.exists(outputPath)).toBe(true)
      const fileString = (await asyncfile.readFile(outputPath)).toString()
      expect(fileString).toMatch(/Id,FirstName,LastName,Email,Gender/s)
      expect(fileString).toMatch(/1,"Daile","Limeburn","dlimeburn0@blogs.com","Female"/s)
      expect(fileString).toMatch(/2,"Murial","Morson","mmorson1@google.nl","Female"/s)
      expect(fileString).toMatch(/3,"Minna","Noe","mnoe2@wikimedia.org","Female"/s)
    })
  })
})
