#!/usr/bin/env python3
import os
import subprocess

def tsc_watch(package):
  return subprocess.Popen('yarn watch-ts', cwd=package, shell=True)

def main():
  package_dir = os.path.join(os.path.dirname(__file__), '..', 'packages')

  pids = [tsc_watch(os.path.join(package_dir, package)) for package in os.listdir(package_dir)]
  input()
  print('killing tsc')
  [p.terminate() for p in pids]
  print('done waiting, exit codes: {}'.format([p.wait(10) for p in pids]))

if __name__ == '__main__':
  main()

