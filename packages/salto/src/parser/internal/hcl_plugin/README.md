# HCL parser in web assembly

---

## TODO high-level description of the project's goal
## Build instructions
### Prerequisites
#### Go
The go compiler is required in order to build the go code to web assembly.
We currently require go version >= 1.13 (beta1)

First make sure you remove any existing go installation from brew:
```
brew uninstall go
rm -rf ~/go
```

Then download and install the required version of go
```
curl https://dl.google.com/go/go1.13beta1.darwin-amd64.pkg -o go.pkg
open go.pkg
```

### Build
Building uses the go compiler and sets the target platform to web assembly
```
env GOOS=js GOARCH=wasm go build -o hcl.wasm
```

Note that usually you will not have to manually build the web assembly file
as it will be built by the external project's typescript build commands