import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import path from 'path'

function getChangedFiles(): string[] {
  const output = execSync('git log --name-status origin/main..HEAD').toString()
  return output
    .split('\n')
    .filter(line => line.startsWith('M') || line.startsWith('A') || line.startsWith('D'))
    .map(line => line.split('\t')[1])
    .filter(file => file && file.startsWith('packages/'))
}

function getAllPackages(): string[] {
  const packagesDir = path.join(__dirname, 'packages')
  return readdirSync(packagesDir).filter(name => {
    const packagePath = path.join(packagesDir, name)
    return existsSync(packagePath) && existsSync(path.join(packagePath, 'package.json'))
  })
}

function hasE2eTests(packageName: string): boolean {
  const e2eDir = path.join(__dirname, 'packages', packageName, 'e2e_test')
  return existsSync(e2eDir) && readdirSync(e2eDir).some(file => file.endsWith('.test.ts'))
}

function hasUnittests(packageName: string): boolean {
  const e2eDir = path.join(__dirname, 'packages', packageName, 'test')
  return existsSync(e2eDir) && readdirSync(e2eDir).some(file => file.endsWith('.test.ts'))
}

function findChangedPackages(): string[] {
  const changedFiles = getChangedFiles()
  const changedPackages = new Set<string>()

  if (changedFiles.length === 0) {
    console.log('No files have changed. Probably on main. Running all e2e tests.')
    return getAllPackages()
  }

  for (const file of changedFiles) {
    const parts = file.split('/')
    if (parts.length > 1) {
      changedPackages.add(parts[1])
    }
  }

  return Array.from(changedPackages)
}

// Trigger packages cause all e2es to run
function getTriggerPackages(): string[] {
  const triggerFilePath = path.join(__dirname, '.circleci', 'e2e-trigger-packages.txt')
  if (!existsSync(triggerFilePath)) {
    console.error(`Error: Trigger packages file not found at ${triggerFilePath}`)
    process.exit(1)
  }

  return readFileSync(triggerFilePath, 'utf-8')
    .split('\n')
    .filter(pkg => pkg.trim() !== '')
}

function main() {
  const changedPackages = findChangedPackages()
  console.log('Changed packages:', changedPackages)

  const triggerPackages = new Set(getTriggerPackages())
  console.log('Trigger packages:', Array.from(triggerPackages))

  const allPackages = new Set(getAllPackages())
  const e2ePackages = new Set<string>()
  const unittestPackages = new Set<string>()

  // Check if any trigger packages have changed
  const triggerAllE2e = changedPackages.some(pkg => triggerPackages.has(pkg))
  if (triggerAllE2e || changedPackages.length === 0) {
    console.log('Trigger packages have changed or running on main. Running all tests.')
    for (const pkg of allPackages) {
      if (hasE2eTests(pkg)) {
        e2ePackages.add(pkg)
      }
      if (hasUnittests(pkg)) {
        unittestPackages.add(pkg)
      }
    }
    return
  } else {
    // Salesforce and Netsuite e2es must also run if the CLI has changed
    if (changedPackages.includes('cli')) {
      console.log('CLI has changed. Adding Salesforce and Netsuite tests.')
      e2ePackages.add('salesforce-adapter')
      e2ePackages.add('netsuite-adapter')
    }
    console.log('Packages with e2e tests that have changed:')
    for (const pkg of changedPackages) {
      if (hasE2eTests(pkg)) {
        e2ePackages.add(pkg)
      }
      if (hasUnittests(pkg)) {
        unittestPackages.add(pkg)
      }
    }
  }

  const e2eOutputFilePath = path.join(__dirname, 'packages-with-e2e-tests.txt')
  const unittestOutputFilePath = path.join(__dirname, 'packages-with-unittests.txt')
  writeFileSync(e2eOutputFilePath, Array.from(e2ePackages).join('\n'))
  writeFileSync(unittestOutputFilePath, Array.from(changedPackages).join('\n'))
  console.log(`Packages with e2e tests that need to run saved to ${e2eOutputFilePath}`)
}

main()
