# Salto - Monitoring

This project is a monitoring tool for identify changes in services using Salto.

### Build instructions

```bash
yarn ; yarn build
```

### Configuration

```hcl
monitoring {
  env = "envName"
  triggers = [
    {
      name = "example"
      title = "super cool title"
      elementIdsRegex = [
      	".*hello.*"
      ]
    },
  ]
  notifications = [
  	{
  	  type = "email"
  	  subject = "Salto | New Alert"
  	  from = "alerts@salto.io"
  	  to = [
  	  	"test@salto.io"
  	  ]
  	  triggers = [
  	  	"example"
  	  ]
  	}
  ]
  smtp = {
  	ssl = true
  	host = "smtp.gmail.com"
  	port = 465
  	username = "alerts@salto.io"
  	password = "supersecret"
  }
}
```

### Run

```bash
./bin/salto_monitoring --workspace /path/to/workspace --env envName --config /path/to/config.nacl
```
